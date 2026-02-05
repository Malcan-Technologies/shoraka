import { ApplicationRepository } from "./repository";
import { ProductRepository } from "../products/repository";
import { OrganizationRepository } from "../organization/repository";
import { invoiceService } from "../invoices/service";
import { CreateApplicationInput, UpdateApplicationStepInput } from "./schemas";
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

  constructor() {
    this.repository = new ApplicationRepository();
    this.productRepository = new ProductRepository();
    this.organizationRepository = new OrganizationRepository();
  }

  /**
   * Map step ID to database field name
   */
  private getFieldNameForStepId(stepId: string): keyof Application | null {
    const stepIdToColumn: Partial<Record<string, keyof Application>> = {
      // step id: field name in application column
      "financing_type_1": "financing_type",
      "financing_structure_1": "financing_structure",
      // contract_details_1 and invoice_details_1 are stored in their own tables
      "company_details_1": "company_details",
      "business_details_1": "business_details",
      "supporting_documents_1": "supporting_documents",
      "declarations_1": "declarations",
      "review_and_submit_1": "review_and_submit",
    };

    return stepIdToColumn[stepId] || null;
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

    // Extract product_id from financing_type
    const financingType = application.financing_type as any;
    const productId = financingType?.product_id;

    let isVersionMismatch = false;
    let latestProductVersion: number | undefined;

    if (productId) {
      const currentProduct = await this.productRepository.findById(productId);
      if (currentProduct) {
        latestProductVersion = currentProduct.version;
        isVersionMismatch = application.product_version !== currentProduct.version;
      }
    }

    return {
      ...application,
      isVersionMismatch,
      latestProductVersion,
    };
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
    const isSpecialStep = ["contract_details_1", "invoice_details_1"].includes(input.stepId);

    if (!fieldName && !isSpecialStep) {
      throw new AppError(400, "INVALID_STEP_ID", `Invalid step ID: ${input.stepId}`);
    }

    const updateData: Prisma.ApplicationUpdateInput = {
      updated_at: new Date(),
    };

    // Only update application column if mapping exists
    if (fieldName) {
      (updateData as any)[fieldName] = input.data as Prisma.InputJsonValue;

      // Special handling for financing_structure to link existing contract
      if (fieldName === "financing_structure") {
        const structureData = input.data as any;
        const prevStructure = application.financing_structure as any;

        if (structureData.structure_type === "existing_contract" && structureData.existing_contract_id) {
          updateData.contract_id = structureData.existing_contract_id;
        } else if (structureData.structure_type === "invoice_only") {
          updateData.contract_id = null;
        } else if (structureData.structure_type === "new_contract" && prevStructure?.structure_type === "existing_contract") {
          // If switching from existing back to new contract, clear the shared link
          updateData.contract_id = null;
        }
      }
    }

    // Update last_completed_step if this is a new step
    if (input.stepNumber >= application.last_completed_step) {
      updateData.last_completed_step = input.stepNumber;
    }

    return this.repository.update(id, updateData);
  }

  /**
   * Update application status
   */
  async updateApplicationStatus(id: string, status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ARCHIVED", userId: string): Promise<Application> {
    // Verify user has access to this application
    await this.verifyApplicationAccess(id, userId);

    const updatedApplication = await this.repository.update(id, {
      status,
      updated_at: new Date(),
    });

    // If status transitioned to SUBMITTED, transition invoices too
    if (status === "SUBMITTED") {
      await invoiceService.transitionInvoicesToSubmitted(id);
    }

    return updatedApplication;
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
}

export const applicationService = new ApplicationService();
