/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment flow (remarks, resubmit, acknowledge, step locking)
 * Guide: docs/guides/application-flow/financial-statements-step.md — Financial statements step architecture and field mappings
 */

import { ApplicationRepository } from "./repository";
import { ProductRepository } from "../products/repository";
import { OrganizationRepository } from "../organization/repository";
import { ContractRepository } from "../contracts/repository";
import {
  CreateApplicationInput,
  UpdateApplicationStepInput,
  businessDetailsDataSchema,
  financialStatementsInputSchema,
} from "./schemas";
import { AppError } from "../../lib/http/error-handler";
import { Application, Prisma, ApplicationStatus as DbApplicationStatus } from "@prisma/client";
import { requestPresignedUploadUrl, deleteDocumentFromS3 } from "./documents/service";
import { deleteS3Object } from "../../lib/s3/client";
import { logger } from "../../lib/logger";
import {
  getAmendmentAllowedSections,
  loadAmendmentRemarks,
  acknowledgeWorkflow as amendmentAcknowledgeWorkflow,
  resubmitApplication as amendmentResubmitApplication,
} from "./amendments/service";
import { prisma } from "../../lib/prisma";
import { logApplicationActivity } from "./logs/service";
import { ActivityLevel, ActivityTarget, ActivityAction, ActivityPortal } from "./logs/types";
import {
  generateContractOfferLetterStream,
  generateInvoiceOfferLetterStream,
  type ContractOfferDetails,
  type InvoiceOfferDetails,
} from "./offer-letter-pdf";
import { computeContractFacilitySnapshot } from "../../lib/contract-facility";
import { ApplicationStatus, ContractStatus, InvoiceStatus, WithdrawReason } from "@cashsouk/types";
import { computeApplicationStatus } from "./lifecycle";

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
   * Extract S3 keys from supporting_documents step data.
   * Handles both { categories: [...] } and { supporting_documents: { categories: [...] } }.
   */
  private extractS3KeysFromSupportingDocuments(data: unknown): Set<string> {
    const keys = new Set<string>();
    if (!data || typeof data !== "object") return keys;
    let raw = data as Record<string, unknown>;
    if (raw.supporting_documents && typeof raw.supporting_documents === "object") {
      raw = raw.supporting_documents as Record<string, unknown>;
    }
    const categories = raw.categories;
    if (!Array.isArray(categories)) return keys;
    for (const cat of categories) {
      const docs = (cat as Record<string, unknown>)?.documents;
      if (!Array.isArray(docs)) continue;
      for (const doc of docs) {
        const file = (doc as Record<string, unknown>)?.file as Record<string, unknown> | undefined;
        const key = file?.s3_key;
        if (typeof key === "string" && key) keys.add(key);
      }
    }
    return keys;
  }

  /**
   * Delete S3 objects on step save failure to prevent orphan files.
   * Logs but does not rethrow.
   */
  private async deleteOrphanS3Keys(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await deleteS3Object(key);
        logger.info({ s3Key: key }, "Deleted orphan S3 file after step save failure");
      } catch (err) {
        logger.warn({ s3Key: key, err }, "Cleanup: failed to delete orphan S3 file");
      }
    }
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
      "financial_statements_1": "financial_statements",
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
      financial_statements: "financial_statements",
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
   * Throw if application status does not allow editing (only DRAFT or AMENDMENT_REQUESTED).
   */
  private verifyApplicationEditable(application: Application | null): void {
    if (!application) return;
    const status = (application as any).status as string;
    if (status !== "DRAFT" && status !== "AMENDMENT_REQUESTED") {
      throw new AppError(403, "EDIT_NOT_ALLOWED", "Application cannot be edited in its current status");
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
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    /** Archived applications must not be accessible through the edit flow. */
    const status = (application as { status?: string }).status;
    if (status === "ARCHIVED") {
      throw new AppError(403, "EDIT_NOT_ALLOWED", "Application cannot be edited in its current status");
    }

    return application;
  }

  /**
   * List applications for an issuer organization (used by issuer dashboard).
   */
  async listByOrganization(organizationId: string, userId: string) {
    // Verify membership
    const member = await this.organizationRepository.getOrganizationMember(
      organizationId,
      userId,
      "issuer"
    );
    if (!member) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this organization");
    }

    return this.repository.listByOrganization(organizationId);
  }

  /**
   * Get amendment context for an application (for issuer edit page).
   * Returns application, review_cycle, and active remarks for the current review_cycle.
   */
  async getAmendmentContext(id: string, userId: string) {
    await this.verifyApplicationAccess(id, userId);
    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    const remarks = await loadAmendmentRemarks(id);
    if (process.env.NODE_ENV !== "production") {
      console.log("[AMENDMENT][API] Application ID:", id);
      console.log("[AMENDMENT][API] Raw remarks from DB:", JSON.stringify(remarks, null, 2));
    }
    return {
      application,
      review_cycle: (application as any).review_cycle ?? 1,
      remarks,
    };
  }

  async getApplicationLogs(id: string, userId: string) {
    await this.verifyApplicationAccess(id, userId);

    const logs = await prisma.applicationLog.findMany({
      where: { application_id: id },
      orderBy: { created_at: "desc" },
    });

    const actorIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[];
    let actorNameMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { user_id: { in: actorIds } },
        select: { user_id: true, first_name: true, last_name: true },
      });
      actorNameMap = new Map(
        users.map((u) => [u.user_id, `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.user_id])
      );
    }

    return logs.map((log) => {
      const meta = (log.metadata as Record<string, unknown>) ?? {};
      const actorName = log.user_id ? actorNameMap.get(log.user_id) ?? null : null;
      return {
        ...log,
        metadata: actorName ? { ...meta, actorName } : meta,
      };
    });
  }

  /**
   * Acknowledge a workflowId during amendment mode.
   * Appends workflowId to application's amendment_acknowledged_workflow_ids if missing.
   */
  async acknowledgeWorkflow(applicationId: string, userId: string, workflowId: string) {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    this.verifyApplicationEditable(application);
    if ((application as any).status !== "AMENDMENT_REQUESTED") {
      throw new AppError(400, "INVALID_STATE", "Acknowledgement allowed only in AMENDMENT_REQUESTED state");
    }
    return amendmentAcknowledgeWorkflow(applicationId, workflowId, this.repository);
  }

  /**
   * Resubmit an application after amendments are acknowledged.
   * 1. Delete only REQUEST_AMENDMENT review records
   * 2. Create application revision snapshot
   * 3. Set status to RESUBMITTED
   */
  async resubmitApplication(applicationId: string, userId: string) {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    if ((application as any).status !== "AMENDMENT_REQUESTED") {
      throw new AppError(400, "INVALID_STATE", "Resubmit allowed only in AMENDMENT_REQUESTED state");
    }
    return amendmentResubmitApplication(applicationId, userId, this.repository);
  }

  /**
   * Update a specific step in the application
   */
  async updateStep(id: string, input: UpdateApplicationStepInput, userId: string): Promise<Application> {
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    this.verifyApplicationEditable(application);

    const fieldName = this.getFieldNameForStepId(input.stepId);
    if (!fieldName) {
      // For steps like contract_details and invoice_details that manage their own saves,
      // just update the last_completed_step without saving data to Application
      const updateData: Prisma.ApplicationUpdateInput = {
        updated_at: new Date(),
      };

      // Do not modify last_completed_step during amendment mode
      if ((application as any).status !== "AMENDMENT_REQUESTED") {
        if (input.forceRewindToStep !== undefined) {
          updateData.last_completed_step = input.forceRewindToStep;
        } else {
          updateData.last_completed_step = Math.max(application.last_completed_step, input.stepNumber);
        }
      }

      return this.repository.update(id, updateData);
    }

    /** Enforce amendment boundaries: only flagged sections/items can be updated. */
    if ((application as any).status === "AMENDMENT_REQUESTED") {
      const { allowedSections } = await getAmendmentAllowedSections(id);
      if (!allowedSections.has(fieldName)) {
        throw new AppError(403, "AMENDMENT_LOCKED", "This section is locked during amendment review");
      }
    }

    if (fieldName === "company_details") {
      this.validateCompanyDetailsData(input.data as Record<string, unknown>);
    }

    let dataToStore: Prisma.InputJsonValue = input.data as Prisma.InputJsonValue;

    if (fieldName === "business_details") {
      const result = businessDetailsDataSchema.safeParse(input.data);
      if (!result.success) {
        const message = result.error.errors.map((e) => e.message).join("; ");
        throw new AppError(400, "VALIDATION_ERROR", message);
      }
      dataToStore = result.data as Prisma.InputJsonValue;
    }

    if (fieldName === "financial_statements") {
      const result = financialStatementsInputSchema.safeParse(input.data);
      if (!result.success) {
        const message = result.error.errors.map((e) => e.message).join("; ");
        throw new AppError(400, "VALIDATION_ERROR", message);
      }
      const raw = result.data;
      const toNum = (v: unknown) => {
        if (typeof v === "number" && !Number.isNaN(v)) return v;
        const n = Number(String(v).replace(/,/g, ""));
        return Number.isNaN(n) ? 0 : n;
      };

      const nonNegativeFields: { key: keyof typeof raw; label: string }[] = [
        { key: "turnover", label: "Turnover" },
        { key: "bsfatot", label: "Fixed assets" },
        { key: "othass", label: "Other assets" },
        { key: "bscatot", label: "Current assets" },
        { key: "bsclbank", label: "Non-current assets" },
        { key: "curlib", label: "Current liability" },
        { key: "bsslltd", label: "Long-term liability" },
        { key: "bsclstd", label: "Non-current liability" },
        { key: "bsqpuc", label: "Paid-up capital" },
        { key: "plnetdiv", label: "Net dividend" },
      ];
      for (const { key, label } of nonNegativeFields) {
        const val = toNum(raw[key]);
        if (val < 0) {
          throw new AppError(400, "VALIDATION_ERROR", `${label} cannot be negative`);
        }
      }

      /** Parse bsdd date string (ISO yyyy-MM-dd or d/M/yyyy) to local midnight Date or null. */
      const parseBsddDate = (s: string): Date | null => {
        if (!s?.trim()) return null;
        const t = s.trim();
        let year: number;
        let month: number;
        let day: number;
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
          year = parseInt(t.slice(0, 4), 10);
          month = parseInt(t.slice(5, 7), 10) - 1;
          day = parseInt(t.slice(8, 10), 10);
        } else {
          const parts = t.split("/");
          if (parts.length !== 3) return null;
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          year = parseInt(parts[2], 10);
        }
        if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year) || month < 0 || month > 11) return null;
        const d = new Date(year, month, day);
        if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
        return d;
      };

      const bsddDate = parseBsddDate(String(raw.bsdd ?? ""));
      if (bsddDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (bsddDate > today) {
          throw new AppError(400, "VALIDATION_ERROR", "Financial data date cannot be in the future.");
        }
      }

      dataToStore = {
        pldd: String(raw.pldd ?? ""),
        bsdd: String(raw.bsdd ?? ""),
        bsfatot: toNum(raw.bsfatot),
        othass: toNum(raw.othass),
        bscatot: toNum(raw.bscatot),
        bsclbank: toNum(raw.bsclbank),
        curlib: toNum(raw.curlib),
        bsslltd: toNum(raw.bsslltd),
        bsclstd: toNum(raw.bsclstd),
        bsqpuc: toNum(raw.bsqpuc),
        turnover: toNum(raw.turnover),
        plnpbt: toNum(raw.plnpbt),
        plnpat: toNum(raw.plnpat),
        plminin: toNum(raw.plminin),
        plnetdiv: toNum(raw.plnetdiv),
        plyear: toNum(raw.plyear),
      } as Prisma.InputJsonValue;
    }

    /** financing_type stores only product_id; product_version lives in application.product_version column. */
    if (fieldName === "financing_type") {
      const financingData = input.data as Record<string, unknown>;
      const productId = financingData?.product_id as string | undefined;
      dataToStore = productId ? { product_id: productId } : dataToStore;
    }

    const updateData: Prisma.ApplicationUpdateInput = {
      [fieldName]: dataToStore,
      updated_at: new Date(),
    };

    /** When financing_type is updated, snapshot product_version from product table. */
    if (fieldName === "financing_type") {
      const financingData = input.data as any;
      const newProductId = financingData?.product_id as string | undefined;
      if (newProductId) {
        const product = await this.productRepository.findById(newProductId);
        if (!product) {
          throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
        }
        (updateData as any).product_version = product.version;
      }
    }

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

        // invoice_only: clear contract_id on draft invoices to prevent inconsistent state
        if (structureData?.structure_type === "invoice_only") {
          await prisma.invoice.updateMany({
            where: {
              application_id: id,
              status: "DRAFT",
              contract_id: { not: null },
            },
            data: { contract_id: null },
          });
        }
      }
    }

    // Update last_completed_step if this is a new step
    // Do not update last_completed_step when in amendment mode
    if ((application as any).status !== "AMENDMENT_REQUESTED") {
      if (input.forceRewindToStep !== undefined) {
        updateData.last_completed_step = input.forceRewindToStep;
      } else {
        updateData.last_completed_step = Math.max(application.last_completed_step, input.stepNumber);
      }
    }

    if (fieldName === "supporting_documents") {
      const existingKeys = this.extractS3KeysFromSupportingDocuments(application.supporting_documents);
      const incomingKeys = this.extractS3KeysFromSupportingDocuments(input.data);
      const newKeys = [...incomingKeys].filter((k) => !existingKeys.has(k));

      try {
        return await this.repository.update(id, updateData);
      } catch (err) {
        await this.deleteOrphanS3Keys(newKeys);
        throw err;
      }
    }

    return this.repository.update(id, updateData);
  }

  /**
   * Delete a draft application. Safe deletion: only removes draft data.
   * - Deletes DRAFT invoices (application_id = id, status = DRAFT)
   * - Deletes DRAFT contract if it was created inside the draft
   * - Never deletes existing contracts or approved/submitted invoices
   */
  async deleteDraftApplication(id: string, userId: string): Promise<void> {
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const status = application.status as ApplicationStatus;
    if (status !== ApplicationStatus.DRAFT) {
      throw new AppError(400, "INVALID_STATE", "Only draft applications can be deleted");
    }

    const contract = (application as any).contract ?? null;

    await prisma.$transaction(async (tx) => {
      /** Delete only DRAFT invoices belonging to this application. Never delete APPROVED/SUBMITTED. */
      await tx.invoice.deleteMany({
        where: {
          application_id: id,
          status: InvoiceStatus.DRAFT,
        },
      });

      /** Safety check: if any non-DRAFT invoices remain, refuse to delete (cascade would remove them). */
      const remainingInvoices = await tx.invoice.count({
        where: { application_id: id },
      });
      if (remainingInvoices > 0) {
        throw new AppError(
          400,
          "HAS_REAL_RECORDS",
          "Cannot delete: application has real financing records. Please contact support."
        );
      }

      /** Delete DRAFT contract only if it was created inside this draft. Never delete existing (APPROVED) contracts. */
      if (contract?.status === ContractStatus.DRAFT && application.contract_id) {
        await tx.application.update({
          where: { id },
          data: { contract_id: null },
        });
        await tx.contract.delete({
          where: { id: contract.id },
        });
      }

      await tx.application.delete({
        where: { id },
      });
    });
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
   * Cancel an application (issuer-only). Withdraws active invoices and contract only.
   */
  async cancelApplication(id: string, userId: string): Promise<Application> {
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const status = application.status as ApplicationStatus;

    if (status === ApplicationStatus.WITHDRAWN) {
      throw new AppError(400, "BAD_REQUEST", "This application has already been withdrawn and cannot be cancelled again.");
    }

    if (
      status === ApplicationStatus.COMPLETED ||
      status === ApplicationStatus.REJECTED ||
      status === ApplicationStatus.ARCHIVED
    ) {
      throw new AppError(400, "BAD_REQUEST", "This application can no longer be cancelled.");
    }

    const contract = (application as any).contract ?? null;
    const invoices = (application as any).invoices ?? [];

    await prisma.$transaction(async (tx) => {
      for (const invoice of invoices) {
        if (
          invoice.status !== InvoiceStatus.APPROVED &&
          invoice.status !== InvoiceStatus.REJECTED &&
          invoice.status !== InvoiceStatus.WITHDRAWN
        ) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: InvoiceStatus.WITHDRAWN,
              withdraw_reason: WithdrawReason.USER_CANCELLED,
            },
          });
        }
      }

      if (
        contract &&
        contract.status !== ContractStatus.APPROVED &&
        contract.status !== ContractStatus.WITHDRAWN &&
        contract.status !== ContractStatus.REJECTED
      ) {
        await tx.contract.update({
          where: { id: contract.id },
          data: {
            status: ContractStatus.WITHDRAWN,
            withdraw_reason: WithdrawReason.USER_CANCELLED,
          },
        });
      }

      const updatedInvoices = await tx.invoice.findMany({
        where: { application_id: id },
      });

      const contractId = contract?.id ?? (application as { contract_id?: string }).contract_id;
      const updatedContract = contractId
        ? await tx.contract.findUnique({ where: { id: contractId } })
        : null;

      const newStatus = computeApplicationStatus(
        updatedContract as { status: ContractStatus } | null,
        updatedInvoices.map((i) => ({ status: i.status as InvoiceStatus })),
        status
      );

      await tx.application.update({
        where: { id },
        data: { status: newStatus as unknown as DbApplicationStatus },
      });
    });

    const updated = await this.repository.findById(id);
    if (!updated) {
      throw new AppError(500, "INTERNAL_ERROR", "Failed to fetch updated application");
    }

    if ((updated.status as string) === "WITHDRAWN") {
      await logApplicationActivity({
        userId,
        applicationId: id,
        eventType: "APPLICATION_WITHDRAWN",
        portal: ActivityPortal.ISSUER,
        metadata: { withdraw_reason: WithdrawReason.USER_CANCELLED },
      });
    }

    return updated;
  }

  /**
   * Request presigned URL for uploading application document.
   * Access and amendment checks performed here; S3 logic delegated to documents service.
   */
  async requestUploadUrl(params: {
    applicationId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    existingS3Key?: string;
    userId: string;
  }): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
    await this.verifyApplicationAccess(params.applicationId, params.userId);
    const application = await this.repository.findById(params.applicationId);
    this.verifyApplicationEditable(application);

    if ((application as any).status === "AMENDMENT_REQUESTED") {
      const { allowedSections } = await getAmendmentAllowedSections(params.applicationId);
      if (!allowedSections.has("supporting_documents")) {
        throw new AppError(403, "AMENDMENT_LOCKED", "This section is locked during amendment review");
      }
    }

    return requestPresignedUploadUrl({
      applicationId: params.applicationId,
      fileName: params.fileName,
      contentType: params.contentType,
      fileSize: params.fileSize,
      existingS3Key: params.existingS3Key,
    });
  }

  /**
   * Delete an application document from S3.
   * Access and amendment checks performed here; S3 deletion delegated to documents service.
   */
  async deleteDocument(applicationId: string, s3Key: string, userId: string): Promise<void> {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    this.verifyApplicationEditable(application);

    if ((application as any).status === "AMENDMENT_REQUESTED") {
      const { allowedSections } = await getAmendmentAllowedSections(applicationId);
      if (!allowedSections.has("supporting_documents")) {
        throw new AppError(403, "AMENDMENT_LOCKED", "This section is locked during amendment review");
      }
    }

    await deleteDocumentFromS3(s3Key);
  }

  /**
   * Update application status and perform cleanup
   */
  async updateApplicationStatus(id: string, status: string, userId: string): Promise<Application> {
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    this.verifyApplicationEditable(application);

    const currentStatus = application.status as string;
    if (status === "RESUBMITTED" && currentStatus !== "AMENDMENT_REQUESTED") {
      throw new AppError(
        400,
        "INVALID_STATE",
        "RESUBMITTED is only allowed when application is in AMENDMENT_REQUESTED status"
      );
    }

    const updateData: Prisma.ApplicationUpdateInput = {
      status: status as any,
      updated_at: new Date(),
    };

    // Create revision on initial submit (DRAFT -> SUBMITTED)
    if (status === "SUBMITTED" && currentStatus === "DRAFT") {
      const appFull = await prisma.application.findUnique({
        where: { id },
        include: { contract: true, invoices: true },
      });
      if (appFull) {
        const snapshot = {
          application: {
            financing_type: appFull.financing_type,
            financing_structure: appFull.financing_structure,
            company_details: appFull.company_details,
            business_details: appFull.business_details,
            financial_statements: appFull.financial_statements,
            supporting_documents: appFull.supporting_documents,
            declarations: appFull.declarations,
            review_and_submit: appFull.review_and_submit,
            last_completed_step: appFull.last_completed_step,
            contract_id: appFull.contract_id,
          },
          contract: appFull.contract ?? null,
          invoices: appFull.invoices ?? [],
        };
        await (prisma as any).applicationRevision.create({
          data: {
            application_id: id,
            review_cycle: (appFull as any).review_cycle ?? 1,
            snapshot,
            submitted_at: new Date(),
          },
        });
      }
    }

    // Resubmit flow is handled by dedicated resubmitApplication method to keep behavior deterministic.
    if (currentStatus === "AMENDMENT_REQUESTED" && status === "RESUBMITTED") {
      const res = await this.resubmitApplication(id, userId);
      // return updated application
      return res as any;
    }

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
            "financial_statements",
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

      /** Ensure child entities are consistent: DRAFT invoices and contract become SUBMITTED. */
      await prisma.invoice.updateMany({
        where: { application_id: id, status: "DRAFT" as any },
        data: { status: "SUBMITTED" as any },
      });
      if (application.contract_id) {
        const contract = await prisma.contract.findUnique({
          where: { id: application.contract_id },
          select: { status: true },
        });
        if ((contract as { status?: string } | null)?.status === "DRAFT") {
          await prisma.contract.update({
            where: { id: application.contract_id },
            data: { status: "SUBMITTED" as any },
          });
        }
      }
    }

    return this.repository.update(id, updateData);
  }

  /**
   * Resolve the invoice review item key. Prefer an existing persisted item_id
   * (matched by invoice number suffix) to avoid index/order drift.
   */
  private async resolveInvoiceReviewItemKeyById(
    applicationId: string,
    application: { invoices?: { id: string; details?: { number?: string | number } }[] },
    invoiceId: string
  ): Promise<string | null> {
    const invoices = application.invoices ?? [];
    const idx = invoices.findIndex((invoice) => invoice.id === invoiceId);
    if (idx < 0) return null;

    const invoiceNo = invoices[idx]?.details?.number ?? idx + 1;
    const sanitized = String(invoiceNo).replace(/:/g, "_");
    const generated = `invoice_details:${idx}:${sanitized}`;

    const existingByNumber = await prisma.applicationReviewItem.findFirst({
      where: {
        application_id: applicationId,
        item_type: "invoice",
        item_id: { endsWith: `:${sanitized}` },
      },
      select: { item_id: true },
    });
    if (existingByNumber?.item_id) return existingByNumber.item_id;

    const exactGenerated = await prisma.applicationReviewItem.findUnique({
      where: {
        application_id_item_type_item_id: {
          application_id: applicationId,
          item_type: "invoice",
          item_id: generated,
        },
      },
      select: { item_id: true },
    });
    return exactGenerated?.item_id ?? generated;
  }

  /**
   * Accept or reject a contract offer. Issuer must be a member of the application's organization.
   */
  async respondToContractOffer(
    applicationId: string,
    action: "accept" | "reject",
    userId: string
  ): Promise<Application> {
    await this.verifyApplicationAccess(applicationId, userId);

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no contract");
    }
    const contractId = application.contract_id;

    const responseMeta = await prisma.$transaction(async (tx) => {
      const lockedContractRows = await tx.$queryRaw<
        {
          status: string;
          offer_details: Prisma.JsonValue | null;
          contract_details: Prisma.JsonValue | null;
        }[]
      >`SELECT status, offer_details, contract_details FROM contracts WHERE id = ${contractId} FOR UPDATE`;

      const contract = lockedContractRows[0];
      if (!contract) {
        throw new AppError(404, "NOT_FOUND", "Contract not found");
      }

      if (contract.status !== "OFFER_SENT") {
        throw new AppError(400, "INVALID_STATE", "No pending contract offer to respond to");
      }

      const offer = contract.offer_details as Record<string, unknown> | null;
      if (!offer || typeof offer !== "object") {
        throw new AppError(400, "INVALID_STATE", "Contract has no offer details");
      }

      if (offer.responded_at != null && offer.responded_at !== "") {
        throw new AppError(400, "ALREADY_RESPONDED", "This offer has already been responded to");
      }

      const expiresAt = offer.expires_at as string | null | undefined;
      if (expiresAt) {
        const expiry = new Date(expiresAt);
        if (expiry < new Date()) {
          throw new AppError(400, "OFFER_EXPIRED", "This offer has expired");
        }
      }

      const now = new Date().toISOString();
      /** Issuer rejecting offer = withdraw financing request. Admin reject = REJECTED. */
      const newStatus = action === "accept" ? "APPROVED" : "WITHDRAWN";
      const offeredFacility = Number(offer.offered_facility) || 0;
      const requestedFacility = Number(offer.requested_facility) || 0;

      const updatedOffer = {
        ...offer,
        responded_at: now,
        responded_by_user_id: userId,
      };

      const cd = (contract.contract_details as Record<string, unknown>) || {};
      const utilizedFacility = typeof cd.utilized_facility === "number" ? cd.utilized_facility : 0;
      const mergedDetails =
        action === "accept"
          ? {
            ...cd,
            approved_facility: offeredFacility,
            utilized_facility: utilizedFacility,
            available_facility: offeredFacility - utilizedFacility,
          }
          : cd;

      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: newStatus,
          offer_details: updatedOffer,
          contract_details: mergedDetails as Prisma.InputJsonValue,
          ...(action === "reject" && { withdraw_reason: WithdrawReason.OFFER_REJECTED }),
        },
      });

      await tx.applicationReview.upsert({
        where: {
          application_id_section: { application_id: applicationId, section: "contract_details" },
        },
        create: {
          application_id: applicationId,
          section: "contract_details",
          status: newStatus,
          reviewer_user_id: userId,
          reviewed_at: new Date(),
        },
        update: {
          status: newStatus,
          reviewer_user_id: userId,
          reviewed_at: new Date(),
        },
      });

      /* --- BEGIN: Recompute and persist application status after contract offer response --- */
      const updatedInvoices = await tx.invoice.findMany({
        where: { application_id: applicationId },
      });
      const updatedContract = await tx.contract.findUnique({
        where: { id: contractId },
      });
      const nextReviewStatusBase =
        action === "accept"
          ? ApplicationStatus.CONTRACT_ACCEPTED
          : (application.status as ApplicationStatus);
      const appStatus = computeApplicationStatus(
        updatedContract as { status: ContractStatus } | null,
        updatedInvoices.map((i) => ({ status: i.status as InvoiceStatus })),
        nextReviewStatusBase
      );
      await tx.application.update({
        where: { id: applicationId },
        data: { status: appStatus as unknown as DbApplicationStatus },
      });
      /* --- END: Recompute and persist application status after contract offer response --- */

      return { offeredFacility, requestedFacility, now, appStatus };
    });

    const eventType =
      action === "accept" ? "CONTRACT_OFFER_ACCEPTED" : "CONTRACT_OFFER_REJECTED";
    await logApplicationActivity({
      userId,
      applicationId,
      level: ActivityLevel.TAB,
      target: ActivityTarget.CONTRACT,
      action: action === "accept" ? ActivityAction.APPROVED : ActivityAction.REJECTED,
      portal: ActivityPortal.ISSUER,
      eventType,
      metadata: {
        offered_facility: responseMeta.offeredFacility,
        requested_facility: responseMeta.requestedFacility,
        responded_at: responseMeta.now,
      },
    });
    if (responseMeta.appStatus === ApplicationStatus.COMPLETED) {
      await logApplicationActivity({
        userId,
        applicationId,
        eventType: "APPLICATION_COMPLETED",
        portal: ActivityPortal.ISSUER,
      });
    }

    const updated = await this.repository.findById(applicationId);
    if (!updated) throw new AppError(500, "INTERNAL_ERROR", "Failed to load updated application");
    return updated;
  }

  /**
   * Accept or reject an invoice offer. Issuer must be a member of the application's organization.
   */
  async respondToInvoiceOffer(
    applicationId: string,
    invoiceId: string,
    action: "accept" | "reject",
    userId: string
  ): Promise<Application> {
    await this.verifyApplicationAccess(applicationId, userId);

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const invoices = (application as { invoices?: { id: string }[] }).invoices ?? [];
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found in this application");
    }

    const scopeKey = await this.resolveInvoiceReviewItemKeyById(
      applicationId,
      application as { invoices?: { id: string; details?: { number?: string | number } }[] },
      invoiceId
    );
    const responseMeta = await prisma.$transaction(async (tx) => {
      const lockedInvoiceRows = await tx.$queryRaw<
        { status: string; offer_details: Prisma.JsonValue | null }[]
      >`SELECT status, offer_details FROM invoices WHERE id = ${invoiceId} AND application_id = ${applicationId} FOR UPDATE`;

      const dbInvoice = lockedInvoiceRows[0];
      if (!dbInvoice) {
        throw new AppError(404, "NOT_FOUND", "Invoice not found");
      }

      if (dbInvoice.status !== "OFFER_SENT") {
        throw new AppError(400, "INVALID_STATE", "No pending invoice offer to respond to");
      }

      const offer = dbInvoice.offer_details as Record<string, unknown> | null;
      if (!offer || typeof offer !== "object") {
        throw new AppError(400, "INVALID_STATE", "Invoice has no offer details");
      }

      if (offer.responded_at != null && offer.responded_at !== "") {
        throw new AppError(400, "ALREADY_RESPONDED", "This offer has already been responded to");
      }

      const expiresAt = offer.expires_at as string | null | undefined;
      if (expiresAt) {
        const expiry = new Date(expiresAt);
        if (expiry < new Date()) {
          throw new AppError(400, "OFFER_EXPIRED", "This offer has expired");
        }
      }

      const now = new Date().toISOString();
      /** Issuer rejecting offer = withdraw financing request. Admin reject = REJECTED. */
      const newStatus = action === "accept" ? "APPROVED" : "WITHDRAWN";
      const offeredAmount = Number(offer.offered_amount) || 0;
      const requestedAmount = Number(offer.requested_amount) || 0;

      const updatedOffer = {
        ...offer,
        responded_at: now,
        responded_by_user_id: userId,
      };

      await tx.invoice.update({
        where: { id: invoiceId, application_id: applicationId },
        data: {
          status: newStatus,
          offer_details: updatedOffer,
          ...(action === "reject" && { withdraw_reason: WithdrawReason.OFFER_REJECTED }),
        },
      });

      if (application.contract_id) {
        const contract = await tx.contract.findUnique({
          where: { id: application.contract_id },
          include: { invoices: true },
        });
        if (contract) {
          const contractDetails = contract.contract_details as Record<string, unknown> | null;
          const { approvedFacility, utilizedFacility, availableFacility } =
            computeContractFacilitySnapshot(
              contract.status,
              contractDetails,
              contract.invoices.map((linkedInvoice) => ({
                status: linkedInvoice.status,
                details: (linkedInvoice.details as Record<string, unknown> | null) ?? null,
                offer_details: (linkedInvoice.offer_details as Record<string, unknown> | null) ?? null,
              }))
            );
          await tx.contract.update({
            where: { id: application.contract_id },
            data: {
              contract_details: {
                ...(contractDetails && typeof contractDetails === "object" ? contractDetails : {}),
                approved_facility: approvedFacility,
                utilized_facility: utilizedFacility,
                available_facility: availableFacility,
              },
            },
          });
        }
      }

      if (scopeKey) {
        await tx.applicationReviewItem.upsert({
          where: {
            application_id_item_type_item_id: {
              application_id: applicationId,
              item_type: "invoice",
              item_id: scopeKey,
            },
          },
          create: {
            application_id: applicationId,
            item_type: "invoice",
            item_id: scopeKey,
            status: newStatus,
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
          update: {
            status: newStatus,
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
        });
      }

      const [invoiceCount, resolvedCount] = await Promise.all([
        tx.invoice.count({ where: { application_id: applicationId } }),
        tx.invoice.count({
          where: {
            application_id: applicationId,
            status: { in: ["APPROVED", "REJECTED", "WITHDRAWN"] },
          },
        }),
      ]);
      let sectionApproved = false;
      if (invoiceCount > 0 && resolvedCount === invoiceCount) {
        await tx.applicationReview.upsert({
          where: {
            application_id_section: { application_id: applicationId, section: "invoice_details" },
          },
          create: {
            application_id: applicationId,
            section: "invoice_details",
            status: "APPROVED",
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
          update: {
            status: "APPROVED",
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
        });
        sectionApproved = true;
      }

      /* --- BEGIN: Recompute and persist application status after invoice offer response --- */
      const updatedInvoices = await tx.invoice.findMany({
        where: { application_id: applicationId },
      });
      const updatedContract = application.contract_id
        ? await tx.contract.findUnique({ where: { id: application.contract_id } })
        : null;
      const invoiceStatuses = updatedInvoices.map((invoice) => invoice.status as InvoiceStatus);
      const allInvoicesOfferedOrResolved =
        invoiceStatuses.length > 0 &&
        invoiceStatuses.every((status) =>
          [
            InvoiceStatus.OFFER_SENT,
            InvoiceStatus.APPROVED,
            InvoiceStatus.WITHDRAWN,
            InvoiceStatus.REJECTED,
          ].includes(status)
        );
      const nextReviewStatusBase = allInvoicesOfferedOrResolved
        ? ApplicationStatus.INVOICES_SENT
        : ApplicationStatus.INVOICE_PENDING;
      const appStatus = computeApplicationStatus(
        updatedContract as { status: ContractStatus } | null,
        invoiceStatuses.map((status) => ({ status })),
        nextReviewStatusBase
      );
      await tx.application.update({
        where: { id: applicationId },
        data: { status: appStatus as unknown as DbApplicationStatus },
      });
      /* --- END: Recompute and persist application status after invoice offer response --- */

      return { now, offeredAmount, requestedAmount, sectionApproved, appStatus };
    });

    const invWithDetails = (application as { invoices?: { id: string; details?: { number?: string | number } }[] })
      .invoices?.find((i) => i.id === invoiceId);
    const invoiceNumber =
      invWithDetails?.details?.number != null && String(invWithDetails.details.number).trim() !== ""
        ? String(invWithDetails.details.number).trim()
        : undefined;

    const eventType =
      action === "accept" ? "INVOICE_OFFER_ACCEPTED" : "INVOICE_OFFER_REJECTED";
    await logApplicationActivity({
      userId,
      applicationId,
      level: ActivityLevel.ITEM,
      target: ActivityTarget.INVOICE,
      action: action === "accept" ? ActivityAction.APPROVED : ActivityAction.REJECTED,
      entityId: scopeKey ?? undefined,
      portal: ActivityPortal.ISSUER,
      eventType,
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        offered_amount: responseMeta.offeredAmount,
        requested_amount: responseMeta.requestedAmount,
        responded_at: responseMeta.now,
      },
    });
    if (responseMeta.appStatus === ApplicationStatus.COMPLETED) {
      await logApplicationActivity({
        userId,
        applicationId,
        eventType: "APPLICATION_COMPLETED",
        portal: ActivityPortal.ISSUER,
      });
    }

    const updated = await this.repository.findById(applicationId);
    if (!updated) throw new AppError(500, "INTERNAL_ERROR", "Failed to load updated application");
    return updated;
  }

  /**
   * Get contract offer letter PDF stream. Requires OFFER_SENT and issuer access.
   */
  async getContractOfferLetter(
    applicationId: string,
    userId: string
  ): Promise<{ stream: ReturnType<typeof generateContractOfferLetterStream>; filename: string }> {
    await this.verifyApplicationAccess(applicationId, userId);

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no contract");
    }

    const contract = await prisma.contract.findUnique({
      where: { id: application.contract_id },
      select: { status: true, offer_details: true },
    });
    if (!contract) {
      throw new AppError(404, "NOT_FOUND", "Contract not found");
    }
    const allowedStatuses = ["OFFER_SENT", "APPROVED", "REJECTED"] as const;
    if (!allowedStatuses.includes(contract.status as (typeof allowedStatuses)[number])) {
      throw new AppError(400, "INVALID_STATE", "No contract offer to download");
    }

    const offer = contract.offer_details as Record<string, unknown> | null;
    if (!offer || typeof offer !== "object") {
      throw new AppError(400, "INVALID_STATE", "Contract has no offer details");
    }

    const offerDetails: ContractOfferDetails = {
      requested_facility: Number(offer.requested_facility) || undefined,
      offered_facility: Number(offer.offered_facility) || undefined,
      expires_at: typeof offer.expires_at === "string" ? offer.expires_at : undefined,
    };

    const stream = generateContractOfferLetterStream(application.contract_id, offerDetails);
    const filename = `contract-offer-${application.contract_id}.pdf`;
    return { stream, filename };
  }

  /**
   * Get invoice offer letter PDF stream. Requires OFFER_SENT and issuer access.
   */
  async getInvoiceOfferLetter(
    applicationId: string,
    invoiceId: string,
    userId: string
  ): Promise<{ stream: ReturnType<typeof generateInvoiceOfferLetterStream>; filename: string }> {
    await this.verifyApplicationAccess(applicationId, userId);

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const invoices = (application as { invoices?: { id: string }[] }).invoices ?? [];
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found in this application");
    }

    const dbInvoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, application_id: applicationId },
      select: { status: true, offer_details: true },
    });
    if (!dbInvoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found");
    }
    const allowedStatuses = ["OFFER_SENT", "APPROVED", "REJECTED"] as const;
    if (!allowedStatuses.includes(dbInvoice.status as (typeof allowedStatuses)[number])) {
      throw new AppError(400, "INVALID_STATE", "No invoice offer to download");
    }

    const offer = dbInvoice.offer_details as Record<string, unknown> | null;
    if (!offer || typeof offer !== "object") {
      throw new AppError(400, "INVALID_STATE", "Invoice has no offer details");
    }

    const offerDetails: InvoiceOfferDetails = {
      requested_amount: Number(offer.requested_amount) || undefined,
      offered_amount: Number(offer.offered_amount) || undefined,
      offered_ratio_percent: Number(offer.offered_ratio_percent) || undefined,
      offered_profit_rate_percent: Number(offer.offered_profit_rate_percent) || undefined,
      expires_at: typeof offer.expires_at === "string" ? offer.expires_at : undefined,
    };

    const stream = generateInvoiceOfferLetterStream(invoiceId, offerDetails);
    const filename = `invoice-offer-${invoiceId}.pdf`;
    return { stream, filename };
  }
}

export const applicationService = new ApplicationService();
