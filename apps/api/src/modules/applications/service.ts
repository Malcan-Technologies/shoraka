import { ApplicationRepository } from "./repository";
import { ProductRepository } from "../products/repository";
import { OrganizationRepository } from "../organization/repository";
import { ContractRepository } from "../contracts/repository";
import {
  CreateApplicationInput,
  UpdateApplicationStepInput,
  businessDetailsDataSchema,
} from "./schemas";
import { AppError } from "../../lib/http/error-handler";
import { Application, Prisma } from "@prisma/client";
import {
  generateApplicationDocumentKey,
  generateApplicationDocumentKeyWithVersion,
  parseApplicationDocumentKey,
  generatePresignedUploadUrl,
  getFileExtension,
  deleteS3Object,
} from "../../lib/s3/client";
import { logger } from "../../lib/logger";

export class ApplicationService {
  private repository: ApplicationRepository;
  private productRepository: ProductRepository;
  private organizationRepository: OrganizationRepository;
  private contractRepository: ContractRepository;

  constructor() {
    this.repository = new ApplicationRepository();
    this.productRepository = new ProductRepository();
    this.organizationRepository = new OrganizationRepository();
    this.contractRepository = new ContractRepository();
  }

  /**
   * Map step ID to database field name.
   * Exact match first; then strip trailing _<digits> and map by base id (e.g. business_details_1738... -> business_details).
   */
  private getFieldNameForStepId(stepId: string): keyof Application | null {
    const stepIdToColumn: Record<string, keyof Application> = {
      "financing_type_1": "financing_type",
      "financing_structure_1": "financing_structure",
      "company_details_1": "company_details",
      "verify_company_info_1": "company_details",
      "business_details_1": "business_details",
      "supporting_documents_1": "supporting_documents",
      "declarations_1": "declarations",
      "review_and_submit_1": "review_and_submit",
    };

    const exact = stepIdToColumn[stepId];
    if (exact) return exact;

    const baseId = stepId.replace(/_\d+$/, "");
    const baseToColumn: Record<string, keyof Application> = {
      financing_type: "financing_type",
      financing_structure: "financing_structure",
      company_details: "company_details",
      verify_company_info: "company_details",
      business_details: "business_details",
      supporting_documents: "supporting_documents",
      declarations: "declarations",
      review_and_submit: "review_and_submit",
    };
    return baseToColumn[baseId] ?? null;
  }

  /**
   * Validate company_details payload: contact_person.ic (digits/dashes only), contact (phone chars only)
   */
  private validateCompanyDetailsData(data: Record<string, unknown>): void {
    const contactPerson = data?.contact_person as Record<string, unknown> | undefined;
    if (!contactPerson) return;

    const ic = typeof contactPerson.ic === "string" ? contactPerson.ic : "";
    if (ic && !/^[\d-]*$/.test(ic)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Applicant IC number must contain only numbers and dashes (no letters)"
      );
    }

    const contact = typeof contactPerson.contact === "string" ? contactPerson.contact : "";
    if (contact && !/^[\d\s+\-()]*$/.test(contact)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Applicant contact must contain only numbers and valid phone characters (+, -, spaces, parentheses)"
      );
    }
  }

  /**
   * Verify that user has access to an application
   * User must be either the owner or a member of the organization that owns the application
   */
  private async verifyApplicationAccess(applicationId: string, userId: string): Promise<void> {
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const organizationId = application.issuer_organization_id;

    // Get the organization from the application
    // The repository includes issuer_organization, but TypeScript doesn't know about it
    // So we use 'as any' to access it (it's safe because we know it's included)
    const organization = (application as any).issuer_organization;

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found for this application");
    }

    // Check if user is owner of the organization
    if (organization.owner_user_id === userId) {
      return; // User is owner, access granted
    }

    // Check if user is a member of the organization
    const member = await this.organizationRepository.getOrganizationMember(
      organizationId,
      userId,
      "issuer"
    );

    if (!member) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this application. You must be a member or owner of the organization."
      );
    }
  }

  /**
   * Create a new application
   */
  async createApplication(input: CreateApplicationInput): Promise<Application> {
    // 1. Fetch product to get latest version
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    // 2. Create application with product version and product_id in financing_type
    return this.repository.create({
      issuer_organization_id: input.issuerOrganizationId,
      product_version: product.version,
      financing_type: {
        product_id: input.productId,
      },
    });
  }

  /**
   * Get application and check product version
   */
  async getApplication(id: string, userId: string) {
    // Verify user has access to this application
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    return application;


  }

  /**
   * Update a specific step in the application
   */
  async updateStep(id: string, input: UpdateApplicationStepInput, userId: string): Promise<Application> {
    // Verify user has access to this application
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const fieldName = this.getFieldNameForStepId(input.stepId);
    if (!fieldName) {
      // For steps like contract_details and invoice_details that manage their own saves,
      // just update the last_completed_step without saving data to Application
      const updateData: Prisma.ApplicationUpdateInput = {
        updated_at: new Date(),
      };

      if (input.forceRewindToStep !== undefined) {
  updateData.last_completed_step = input.forceRewindToStep;
} else {
  updateData.last_completed_step = Math.max(
    application.last_completed_step,
    input.stepNumber
  );
}


      return this.repository.update(id, updateData);
    }

    if (fieldName === "company_details") {
      this.validateCompanyDetailsData(input.data as Record<string, unknown>);
    }

    if (fieldName === "business_details") {
      const result = businessDetailsDataSchema.safeParse(input.data);
      if (!result.success) {
        const message = result.error.errors.map((e) => e.message).join("; ");
        throw new AppError(400, "VALIDATION_ERROR", message);
      }
    }

    const updateData: Prisma.ApplicationUpdateInput = {
      [fieldName]: input.data as Prisma.InputJsonValue,
      updated_at: new Date(),
    };

    // Special handling for financing_structure: link existing contract if selected
    if (fieldName === "financing_structure") {
      const structureData = input.data as any;
      if (structureData?.structure_type === "existing_contract" && structureData?.existing_contract_id) {
        // Validate the contract before linking
        const contract = await this.contractRepository.findById(structureData.existing_contract_id);

        if (!contract) {
          throw new AppError(404, "CONTRACT_NOT_FOUND", "The selected contract does not exist.");
        }

        if (contract.issuer_organization_id !== application.issuer_organization_id) {
          throw new AppError(403, "FORBIDDEN", "Cannot link contract from a different organization.");
        }

        if (contract.status !== "APPROVED") {
          throw new AppError(400, "INVALID_CONTRACT_STATUS", "Only approved contracts can be linked to applications.");
        }

        // Link the existing contract to this application
        updateData.contract = { connect: { id: structureData.existing_contract_id } };
      } else if (structureData?.structure_type === "invoice_only" || structureData?.structure_type === "new_contract") {
        // Unlink any contract if invoice-only OR new_contract is selected
        // This ensures switching from existing_contract → new_contract properly disconnects the FK
        if (application.contract_id) {
          updateData.contract = { disconnect: true };
        }

        // Invoice-related persistence removed.
        // Previously: clear contract_id from invoices via prisma.invoice.updateMany(...)
        // That behavior has been removed as invoice APIs were deleted.
      }
    }

    // Update last_completed_step if this is a new step
    if (input.forceRewindToStep !== undefined) {
  updateData.last_completed_step = input.forceRewindToStep;
} else {
  updateData.last_completed_step = Math.max(
    application.last_completed_step,
    input.stepNumber
  );
}

    return this.repository.update(id, updateData);
  }

  /**
   * Archive an application
   */
  async archiveApplication(id: string, userId: string): Promise<Application> {
    // Verify user has access to this application
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    return this.repository.update(id, {
      status: "ARCHIVED",
      updated_at: new Date(),
    });
  }

  /**
   * Generate a simple cuid-like string for S3 keys
   */
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}${random}`;
  }

  /**
   * Request presigned URL for uploading application document
   */
  async requestUploadUrl(params: {
    applicationId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    existingS3Key?: string;
    userId: string;
  }): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
    // Verify user has access to this application
    await this.verifyApplicationAccess(params.applicationId, params.userId);
    // Validate file type (PDF only)
    if (params.contentType !== "application/pdf") {
      throw new AppError(400, "VALIDATION_ERROR", "File type not allowed. Please upload PDF files only.");
    }

    // Validate file size (max 5MB)
    const maxSizeInBytes = 5 * 1024 * 1024;
    if (params.fileSize > maxSizeInBytes) {
      throw new AppError(400, "VALIDATION_ERROR", "File size must be less than 5MB");
    }

    // Get file extension
    const extension = getFileExtension(params.fileName) || "pdf";

    let s3Key: string;

    if (params.existingS3Key) {
      // Parse existing key to get version and cuid
      const parsed = parseApplicationDocumentKey(params.existingS3Key);
      if (!parsed) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid existing S3 key format");
      }

      // Generate new key with incremented version
      const newKey = generateApplicationDocumentKeyWithVersion({
        existingS3Key: params.existingS3Key,
        extension,
      });

      if (!newKey) {
        throw new AppError(400, "VALIDATION_ERROR", "Failed to generate new S3 key");
      }

      s3Key = newKey;
    } else {
      // Generate new cuid and create v1 key
      const cuid = this.generateCuid();
      s3Key = generateApplicationDocumentKey({
        applicationId: params.applicationId,
        cuid,
        extension,
        version: 1,
      });
    }

    // Generate presigned upload URL
    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: params.contentType,
      contentLength: params.fileSize,
    });

    return {
      uploadUrl,
      s3Key,
      expiresIn,
    };
  }

  /**
   * Delete an application document from S3
   */
  async deleteDocument(applicationId: string, s3Key: string, userId: string): Promise<void> {
    // Verify user has access to this application
    await this.verifyApplicationAccess(applicationId, userId);
    try {
      await deleteS3Object(s3Key);
      logger.info({ s3Key }, "Deleted application document from S3");
    } catch (error) {
      logger.warn({ s3Key, error }, "Failed to delete application document from S3");
      throw new AppError(500, "DELETE_FAILED", "Failed to delete document from S3");
    }
  }

  /**
   * Update application status and perform cleanup
   */
  async updateApplicationStatus(id: string, status: string, userId: string): Promise<Application> {
    // Verify user has access to this application
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const updateData: Prisma.ApplicationUpdateInput = {
      status: status as any,
      updated_at: new Date(),
    };

    // If submitting, perform cleanup of unused steps
    if (status === "SUBMITTED") {
      // Get product to find active steps
      const financingType = application.financing_type as any;
      const productId = financingType?.product_id;

      if (productId) {
        const product = await this.productRepository.findById(productId);
        if (product) {
          const workflow = (product.workflow as any[]) || [];
          const activeStepKeys = new Set(workflow.map((step: any) => {
            const rawKey = step.id.replace(/_\d+$/, "");
            if (rawKey === "verify_company_info") return "company_details";
            return rawKey;
          }));

          const allStepColumns = [
            "financing_type",
            "financing_structure",
            "company_details",
            "business_details",
            "supporting_documents",
            "declarations",
            "review_and_submit",
          ];

          allStepColumns.forEach(col => {
            if (!activeStepKeys.has(col)) {
              (updateData as any)[col] = Prisma.JsonNull;
            }
          });

          if (!activeStepKeys.has("contract_details") && application.contract_id) {
            (updateData as any).contract = { disconnect: true };
          }

          // if (!activeStepKeys.has("invoice_details")) {
          //   await prisma.invoice.deleteMany({ where: { application_id: id } });
          // }
        }
      }

      (updateData as any).submitted_at = new Date();
    }

    return this.repository.update(id, updateData);
  }
}

export const applicationService = new ApplicationService();
