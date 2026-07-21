/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment flow (remarks, resubmit, acknowledge, step locking)
 * Guide: docs/guides/application-flow/financial-statements-step.md — Financial statements step architecture and field mappings
 */

import { ApplicationRepository } from "./repository";
import { ProductRepository } from "../products/repository";
import { OrganizationRepository } from "../organization/repository";
import { OrganizationService } from "../organization/service";
import { ContractRepository } from "../contracts/repository";
import {
  CreateApplicationInput,
  UpdateApplicationStepInput,
  businessDetailsDataSchema,
  financialStatementsInputSchema,
  financialStatementsV2Schema,
} from "./schemas";
import { AppError } from "../../lib/http/error-handler";
import {
  Application,
  Prisma,
  ApplicationStatus as DbApplicationStatus,
  ProductStatus,
  ReviewStepStatus,
} from "@prisma/client";
import { requestPresignedUploadUrl, deleteDocumentFromS3 } from "./documents/service";
import { shouldPreserveApplicationDocumentsInS3 } from "./amendment-preserve-s3";
import {
  assertRequiredSupportingDocumentsPresent,
  assertRequiredAcceptanceDocumentsPresent,
  fileNameToSupportingDocTypeToken,
  getGuarantorAgreementAllowedTypesFromProductWorkflow,
  getSupportingDocAllowedTypesFromProductWorkflow,
} from "./supporting-docs-workflow";
import {
  resolveAcceptanceDocumentAllowedTypes,
  resolveAcceptanceDocumentsFromWorkflow,
  collectAcceptanceDocumentReviewKeys,
  workflowHasAcceptanceDocuments,
  getOfferAcceptanceFromOfferDetails,
  offerAcceptanceIsStep1Editable,
  requiredOfferAcknowledgementKeys,
  resolveOfferAcknowledgementsFromWorkflow,
  resolveStatusAfterOfferAcceptanceSubmit,
  workflowUsesOfferAcceptanceFlow,
} from "@cashsouk/types";
import {
  mergeAcknowledgementRecords,
  patchOfferAcceptance,
} from "./offer-acceptance";
import { buildApplicationRevisionSnapshot } from "./revision-snapshot";
import {
  upsertLatestOrganizationFinancialStatementsFromApplication,
} from "./issuer-organization-financial-statements";
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
import { ActivityPortal } from "./logs/types";
import { assertApplicationProcessingFeePaid } from "../payment/processing-fee-service";
import {
  generateContractOfferLetterStream,
  generateInvoiceOfferLetterStream,
  type ContractOfferDetails,
  type InvoiceOfferDetails,
} from "./offer-letter-pdf";
import { computeContractFacilitySnapshot } from "../../lib/contract-facility";
import { resolveOfferedPlatformFeeRatePercent } from "../../lib/invoice-offer";
import {
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  WithdrawReason,
  canDirectAcceptInvoice,
  getFinancialYearEndComputationDetails,
  getIssuerFinancialTabYears,
  issuerUnauditedPlddForFyEndYear,
  getStepKeyFromStepId,
  hasActionableDirectorShareholder,
} from "@cashsouk/types";
import { computeApplicationStatus } from "./lifecycle";
import { getS3ObjectBuffer } from "../../lib/s3/client";
import { NotificationService } from "../notification/service";
import { NotificationTypeIds } from "../notification/registry";
import { getIssuerRecipientUserIdsForApplication } from "../notification/application-recipients";
import {
  parseGuarantorsFromBusinessDetails,
} from "../guarantors/utils";
import { assertIssuerOrgDirectorShareholderOnboardingReady } from "./director-shareholder-onboarding-guard";
import { buildAdminPeopleList } from "../admin/build-people-list";

function financialToNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function isFinalApplicationStatus(status: string | null | undefined): boolean {
  return status === "APPROVED" || status === "FUNDED" || status === "COMPLETED";
}

/** Business rules for v2 per-year financial blocks (no bsdd). */
function validateFinancialYearBlockOrThrow(raw: {
  pldd?: string;
  bsfatot?: unknown;
  othass?: unknown;
  bscatot?: unknown;
  bsclbank?: unknown;
  curlib?: unknown;
  bsslltd?: unknown;
  bsclstd?: unknown;
  bsqpuc?: unknown;
  turnover?: unknown;
  plnpbt?: unknown;
  plnpat?: unknown;
  plnetdiv?: unknown;
  plyear?: unknown;
}): void {
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
    const val = financialToNum(raw[key]);
    if (val < 0) {
      throw new AppError(400, "VALIDATION_ERROR", `${label} cannot be negative`);
    }
  }

}

function normalizeFinancialYearBlock(
  raw: Record<string, unknown>
): Prisma.InputJsonValue {
  return {
    pldd: String(raw.pldd ?? ""),
    bsfatot: financialToNum(raw.bsfatot),
    othass: financialToNum(raw.othass),
    bscatot: financialToNum(raw.bscatot),
    bsclbank: financialToNum(raw.bsclbank),
    curlib: financialToNum(raw.curlib),
    bsslltd: financialToNum(raw.bsslltd),
    bsclstd: financialToNum(raw.bsclstd),
    bsqpuc: financialToNum(raw.bsqpuc),
    turnover: financialToNum(raw.turnover),
    plnpbt: financialToNum(raw.plnpbt),
    plnpat: financialToNum(raw.plnpat),
    plnetdiv: financialToNum(raw.plnetdiv),
    plyear: financialToNum(raw.plyear),
  } as Prisma.InputJsonValue;
}

export class ApplicationService {
  private repository: ApplicationRepository;
  private productRepository: ProductRepository;
  private organizationRepository: OrganizationRepository;
  private contractRepository: ContractRepository;
  private notificationService: NotificationService;

  constructor() {
    this.repository = new ApplicationRepository();
    this.productRepository = new ProductRepository();
    this.organizationRepository = new OrganizationRepository();
    this.contractRepository = new ContractRepository();
    this.notificationService = new NotificationService();
  }

  private async sendIssuerNotification(
    applicationId: string,
    typeId: (typeof NotificationTypeIds)[keyof typeof NotificationTypeIds],
    payload: Record<string, unknown>,
    idempotencySuffix: string
  ) {
    const recipientUserIds = await getIssuerRecipientUserIdsForApplication(applicationId);
    await Promise.all(
      recipientUserIds.map((userId) =>
        this.notificationService.sendTyped(
          userId,
          typeId as never,
          payload as never,
          `app:${applicationId}:notif:${typeId}:user:${userId}:${idempotencySuffix}`
        )
      )
    );
  }

  private async syncApplicationGuarantors(
    tx: Prisma.TransactionClient,
    applicationId: string,
    businessDetails: unknown
  ): Promise<void> {
    const parsed = parseGuarantorsFromBusinessDetails(businessDetails);
    await tx.applicationGuarantor.deleteMany({ where: { application_id: applicationId } });
    if (parsed.length === 0) return;

    for (const row of parsed) {
      await tx.applicationGuarantor.create({
        data: {
          application_id: applicationId,
          client_guarantor_id: row.guarantorId,
          guarantor_type: row.guarantorType,
          email: row.email,
          name: row.guarantorType === "individual" ? row.name ?? null : null,
          ic_number: row.guarantorType === "individual" ? row.icNumber ?? null : null,
          business_name: row.guarantorType === "company" ? row.businessName ?? null : null,
          ssm_number: row.guarantorType === "company" ? row.ssmNumber ?? null : null,
          position: row.position,
          source_data: row.sourceData as Prisma.InputJsonValue,
        },
      });
    }
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
        const singleKey = file?.s3_key;
        if (typeof singleKey === "string" && singleKey) keys.add(singleKey);

        const files = (doc as Record<string, unknown>)?.files;
        if (Array.isArray(files)) {
          for (const f of files) {
            const key = (f as Record<string, unknown>)?.s3_key;
            if (typeof key === "string" && key) keys.add(key);
          }
        }
      }
    }
    return keys;
  }

  private extractS3KeysFromAcceptanceDocuments(data: unknown): Set<string> {
    const keys = new Set<string>();
    if (!data || typeof data !== "object") return keys;
    const root = data as Record<string, unknown>;
    const docs = Array.isArray(root.documents) ? root.documents : Array.isArray(data) ? data : [];
    for (const doc of docs) {
      const record = doc as Record<string, unknown>;
      const file = record?.file as Record<string, unknown> | undefined;
      if (typeof file?.s3_key === "string" && file.s3_key) keys.add(file.s3_key);
      const files = record?.files;
      if (Array.isArray(files)) {
        for (const f of files) {
          const key = (f as Record<string, unknown>)?.s3_key;
          if (typeof key === "string" && key) keys.add(key);
        }
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
      "acceptance_documents_1": "acceptance_documents",
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
      acceptance_documents: "acceptance_documents",
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

  private hasOfferBeenSent(application: Application | null): boolean {
    if (!application) return false;
    const status = (application as { status?: string }).status;
    if (
      status === ApplicationStatus.CONTRACT_SENT ||
      status === ApplicationStatus.INVOICES_SENT ||
      status === ApplicationStatus.CONTRACT_ACCEPTED ||
      status === ApplicationStatus.APPROVED
    ) {
      return true;
    }
    const contract = (application as { contract?: { status?: string } | null }).contract;
    if (contract?.status === ContractStatus.OFFER_SENT) return true;
    const invoices = (application as { invoices?: Array<{ status?: string }> }).invoices ?? [];
    return invoices.some((invoice) => invoice.status === InvoiceStatus.OFFER_SENT);
  }

  private async assertPostApplicationPrepUnlocked(applicationId: string): Promise<void> {
    const lockedEnvelope = await prisma.signingEnvelope.findFirst({
      where: {
        application_id: applicationId,
        status: { in: ["SENT", "IN_PROGRESS", "COMPLETED"] },
      },
      select: { id: true },
    });
    if (lockedEnvelope) {
      throw new AppError(
        403,
        "SIGNING_PREP_LOCKED",
        "Post-application documents are locked after the signing package is sent. Void the package to make changes."
      );
    }
  }

  private async verifyAcceptanceDocumentsEditable(
    application: Application | null
  ): Promise<void> {
    if (!this.hasOfferBeenSent(application)) {
      throw new AppError(
        403,
        "EDIT_NOT_ALLOWED",
        "Acceptance documents can be uploaded after an offer is sent"
      );
    }
    if (!application) return;
    await this.assertPostApplicationPrepUnlocked(application.id);

    const workflow = await this.getProductWorkflowForApplication(application);
    if (!workflowUsesOfferAcceptanceFlow(workflow)) return;

    const contract = (application as { contract?: { offer_details?: unknown } | null }).contract;
    const invoices =
      (application as { invoices?: { contract_id?: string | null; offer_details?: unknown }[] })
        .invoices ?? [];
    const standaloneInvoiceOffer = invoices.find(
      (invoice) => !invoice.contract_id && invoice.offer_details
    );
    const offer =
      (contract?.offer_details as Record<string, unknown> | null) ??
      (standaloneInvoiceOffer?.offer_details as Record<string, unknown> | null) ??
      null;

    const acceptance = offer ? getOfferAcceptanceFromOfferDetails(offer) : null;
    if (!acceptance) {
      // Phase missing on a phased product (legacy/repair path) — allow the upload.
      return;
    }
    if (!offerAcceptanceIsStep1Editable(acceptance.status)) {
      throw new AppError(
        403,
        "EDIT_NOT_ALLOWED",
        "Acceptance documents cannot be edited once the offer acceptance step has moved past issuer review."
      );
    }
  }

  private async verifyApplicationStepEditable(
    application: Application | null,
    fieldName: string | null
  ): Promise<void> {
    if (!application) return;
    const status = (application as { status?: string }).status;
    if (status === ApplicationStatus.DRAFT || status === ApplicationStatus.AMENDMENT_REQUESTED) {
      return;
    }
    if (fieldName === "acceptance_documents") {
      await this.verifyAcceptanceDocumentsEditable(application);
      return;
    }
    throw new AppError(403, "EDIT_NOT_ALLOWED", "Application cannot be edited in its current status");
  }

  private async getProductWorkflowForApplication(application: Application | null): Promise<unknown[]> {
    const productId = (application?.financing_type as { product_id?: string } | null | undefined)
      ?.product_id;
    if (!productId || typeof productId !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "Application has no product for document upload");
    }
    const productVersion = (application as { product_version?: number | null } | null)?.product_version;
    const product =
      productVersion != null
        ? await this.productRepository.findByBaseAndVersion(productId, productVersion)
        : await this.productRepository.findById(productId);
    if (!product) {
      throw new AppError(400, "VALIDATION_ERROR", "Product not found");
    }
    return (product.workflow as unknown[]) ?? [];
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
   * Authorize access to application-scoped S3 objects (uploads, signing PDFs).
   * Admins may access any application that exists; issuers need org membership.
   */
  async assertCanAccessApplicationDocuments(params: {
    applicationId: string;
    userId: string;
    asAdmin?: boolean;
  }): Promise<void> {
    if (params.asAdmin) {
      const application = await this.repository.findById(params.applicationId);
      if (!application) {
        throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
      }
      return;
    }
    await this.verifyApplicationAccess(params.applicationId, params.userId);
  }

  /**
   * Create a new application
   */
  async createApplication(input: CreateApplicationInput): Promise<Application> {
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }
    if (product.status !== ProductStatus.ACTIVE) {
      throw new AppError(
        400,
        "PRODUCT_NOT_ACTIVE",
        "This financing product is not available. Refresh the product list and select a current product."
      );
    }

    // Create application with product version and product_id in financing_type
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
   * Issuer guard: version to compare against application.product_version (INACTIVE row → ACTIVE successor by base_id).
   */
  async getProductVersionCompareForApplication(applicationId: string, userId: string) {
    await this.verifyApplicationAccess(applicationId, userId);

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const financing = application.financing_type as Record<string, unknown> | null | undefined;
    const productId = financing?.product_id as string | undefined;
    if (!productId?.trim()) {
      return { outcome: "NO_PRODUCT_ID" as const };
    }

    const target = await this.productRepository.getVersionCompareTarget(productId.trim());
    if (target.kind === "UNAVAILABLE") {
      return { outcome: "PRODUCT_UNAVAILABLE" as const };
    }
    return { outcome: "COMPARE" as const, compare_version: target.version };
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

    const applications = await this.repository.listByOrganization(organizationId);

    const org = await prisma.issuerOrganization.findUnique({
      where: { id: organizationId },
      select: { corporate_entities: true, director_kyc_status: true, director_aml_status: true },
    });
    let directorShareholderAmlPending = false;
    if (org) {
      const organizationService = new OrganizationService();
      const extras = await organizationService.getIssuerPartyListExtras(organizationId);
      const people = buildAdminPeopleList({
        ctos: extras.latestOrganizationCtosCompanyJson ?? null,
        issuerDirectorKycStatus: org.director_kyc_status ?? null,
        issuerDirectorAmlStatus: org.director_aml_status ?? null,
        ctosPartySupplements: extras.ctosPartySupplements,
        corporateEntities: org.corporate_entities ?? null,
      });
      directorShareholderAmlPending = hasActionableDirectorShareholder(people);
    }

    return applications.map((application) => ({
      ...application,
      directorShareholderAmlPending: isFinalApplicationStatus(application.status)
        ? false
        : directorShareholderAmlPending,
    }));
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
      logger.debug({ applicationId: id, remarks }, "[AMENDMENT][API] Raw remarks from DB");
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
      const mergedMeta = actorName ? { ...meta, actorName } : meta;
      let activity: string | undefined;
      const resubmitChanges = mergedMeta.resubmit_changes as { activity_summary?: string } | undefined;
      if (log.event_type === "APPLICATION_RESUBMITTED" && resubmitChanges?.activity_summary) {
        activity = resubmitChanges.activity_summary;
      }
      return {
        ...log,
        metadata: mergedMeta,
        ...(activity ? { activity } : {}),
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
    await assertIssuerOrgDirectorShareholderOnboardingReady(application.issuer_organization_id);
    const result = await amendmentResubmitApplication(applicationId, userId, this.repository);

    try {
      await this.sendIssuerNotification(
        applicationId,
        NotificationTypeIds.APPLICATION_RESUBMITTED_CONFIRMATION,
        {
          applicationId,
          reviewCycle: (result as { review_cycle?: number })?.review_cycle ?? ((application as { review_cycle?: number }).review_cycle ?? 1) + 1,
        },
        `resubmitted:${(result as { review_cycle?: number })?.review_cycle ?? "next"}`
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, applicationId },
        "Failed to send application resubmitted confirmation notification"
      );
    }

    return result;
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

    const fieldName = this.getFieldNameForStepId(input.stepId);
    await this.verifyApplicationStepEditable(application, fieldName);
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
      const { guarantors: _guarantors, ...businessDetailsWithoutGuarantors } = result.data;
      dataToStore = businessDetailsWithoutGuarantors as Prisma.InputJsonValue;
    }

    if (fieldName === "financial_statements") {
      const payload = input.data as Record<string, unknown>;
      if (
        !payload ||
        typeof payload !== "object" ||
        payload.questionnaire == null ||
        typeof payload.questionnaire !== "object"
      ) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "financial_statements must be v2: questionnaire and unaudited_by_year are required"
        );
      }

      const v2 = financialStatementsV2Schema.safeParse(payload);
      if (!v2.success) {
        const message = v2.error.errors.map((e) => e.message).join("; ");
        throw new AppError(400, "VALIDATION_ERROR", message);
      }
      const { questionnaire, unaudited_by_year } = v2.data;
      const serverNow = new Date();
      const dbg = getFinancialYearEndComputationDetails(questionnaire, serverNow);
      logger.debug(
        {
          fye: dbg.fye,
          previousFYEndIso: dbg.previousFYEndIso,
          deadlineIso: dbg.deadlineIso,
          todayIso: dbg.todayIso,
          years: dbg.years,
        },
        "Financial statements FYE computation"
      );
      const expectedYears = getIssuerFinancialTabYears(questionnaire, serverNow);
      const actualKeys = Object.keys(unaudited_by_year).sort();
      const expectedStr = expectedYears.map((y) => String(y)).sort();
      if (actualKeys.length !== expectedStr.length || actualKeys.some((k, i) => k !== expectedStr[i])) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `Unaudited years must match FYE rules: expected ${expectedStr.join(", ") || "(none)"}`
        );
      }

      const normalizedByYear: Record<string, Prisma.InputJsonValue> = {};
      for (const y of expectedYears) {
        const key = String(y);
        const blockResult = financialStatementsInputSchema.safeParse(unaudited_by_year[key]);
        if (!blockResult.success) {
          const message = blockResult.error.errors.map((e) => e.message).join("; ");
          throw new AppError(400, "VALIDATION_ERROR", `${key}: ${message}`);
        }
        const expectedPldd = issuerUnauditedPlddForFyEndYear(y, questionnaire);
        if (blockResult.data.pldd !== expectedPldd) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            `${key}: pldd must equal FY end date for that column`
          );
        }
        const block = { ...blockResult.data, pldd: expectedPldd };
        validateFinancialYearBlockOrThrow(block);
        normalizedByYear[key] = normalizeFinancialYearBlock(block as Record<string, unknown>);
      }

      dataToStore = {
        questionnaire,
        unaudited_by_year: normalizedByYear,
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
        // invoice_only allows at most one invoice; block the switch instead of auto-deleting existing invoices
        if (structureData?.structure_type === "invoice_only") {
          const existingInvoices =
            (application as { invoices?: { id: string }[] }).invoices ?? [];
          if (existingInvoices.length > 1) {
            throw new AppError(
              400,
              "MAX_INVOICES_REACHED",
              "Cannot switch to invoice-only: this application already has more than one invoice. Remove the extra invoices first."
            );
          }
        }

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

    if (fieldName === "business_details") {
      return prisma.$transaction(async (tx) => {
        const updated = await tx.application.update({
          where: { id },
          data: updateData,
        });
        await this.syncApplicationGuarantors(tx, id, input.data);
        return updated as Application;
      });
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

      const isInvoiceOnly =
        (application as { financing_structure?: { structure_type?: string } }).financing_structure
          ?.structure_type === "invoice_only";
      const newStatus = computeApplicationStatus(
        updatedContract as { status: ContractStatus } | null,
        updatedInvoices.map((i) => ({ status: i.status as InvoiceStatus })),
        status,
        { isInvoiceOnly }
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
      try {
        await this.sendIssuerNotification(
          id,
          NotificationTypeIds.APPLICATION_WITHDRAWN_CONFIRMATION,
          { applicationId: id },
          "withdrawn:user-cancelled"
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId: id },
          "Failed to send application withdrawn confirmation notification"
        );
      }
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
    supportingDocCategoryKey?: string;
    supportingDocIndex?: number;
    acceptanceDocIndex?: number;
    guarantorAgreementUpload?: boolean;
    userId: string;
  }): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
    await this.verifyApplicationAccess(params.applicationId, params.userId);
    const application = await this.repository.findById(params.applicationId);
    const isSupportingDocsWorkflowUpload =
      params.supportingDocCategoryKey !== undefined &&
      params.supportingDocIndex !== undefined;
    const isAcceptanceDocUpload = params.acceptanceDocIndex !== undefined;
    const isGuarantorAgreementUpload = params.guarantorAgreementUpload === true;
    let workflow: unknown[] | null = null;
    if (isAcceptanceDocUpload) {
      workflow = await this.getProductWorkflowForApplication(application);
      const rows = resolveAcceptanceDocumentsFromWorkflow(workflow);
      const row = rows[params.acceptanceDocIndex!];
      if (!row) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid acceptance document slot");
      }
      await this.verifyAcceptanceDocumentsEditable(application);
    } else if (isSupportingDocsWorkflowUpload) {
      workflow = await this.getProductWorkflowForApplication(application);
      this.verifyApplicationEditable(application);
    } else if (isGuarantorAgreementUpload) {
      workflow = await this.getProductWorkflowForApplication(application);
      this.verifyApplicationEditable(application);
    } else {
      this.verifyApplicationEditable(application);
    }

    if ((application as any).status === "AMENDMENT_REQUESTED") {
      const { allowedSections } = await getAmendmentAllowedSections(params.applicationId);
      if (isAcceptanceDocUpload) {
        // Acceptance docs are post-offer; amendment locks do not apply.
      } else if (isSupportingDocsWorkflowUpload) {
        if (!allowedSections.has("supporting_documents")) {
          throw new AppError(403, "AMENDMENT_LOCKED", "This section is locked during amendment review");
        }
      } else if (isGuarantorAgreementUpload) {
        if (!allowedSections.has("business_details")) {
          throw new AppError(403, "AMENDMENT_LOCKED", "This section is locked during amendment review");
        }
      } else {
        /** Generic uploads use this path without category keys. */
        const canGenericUpload =
          allowedSections.has("business_details") || allowedSections.has("supporting_documents");
        if (!canGenericUpload) {
          throw new AppError(403, "AMENDMENT_LOCKED", "This section is locked during amendment review");
        }
      }
    }

    let allowedTypes: string[];
    if (isAcceptanceDocUpload) {
      const rows = resolveAcceptanceDocumentsFromWorkflow(workflow ?? []);
      const row = rows[params.acceptanceDocIndex!];
      allowedTypes = resolveAcceptanceDocumentAllowedTypes(row ?? {});
    } else if (isSupportingDocsWorkflowUpload) {
      allowedTypes = getSupportingDocAllowedTypesFromProductWorkflow(
        workflow ?? [],
        params.supportingDocCategoryKey!,
        params.supportingDocIndex!
      );
    } else if (isGuarantorAgreementUpload) {
      allowedTypes = getGuarantorAgreementAllowedTypesFromProductWorkflow(workflow ?? []);
    } else {
      allowedTypes = ["pdf"];
    }

    const token = fileNameToSupportingDocTypeToken(params.fileName);
    if (!token || !allowedTypes.includes(token)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid file type");
    }

    logger.debug(
      { fileName: params.fileName, token, allowedTypes },
      "Application supporting-doc upload URL resolution"
    );

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
   * Post-offer supporting-doc removals are allowed while signing prep is unlocked (NAV-03/04).
   */
  async deleteDocument(applicationId: string, s3Key: string, userId: string): Promise<void> {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const status = (application as { status?: string }).status;
    if (status === ApplicationStatus.DRAFT || status === ApplicationStatus.AMENDMENT_REQUESTED) {
      if (status === ApplicationStatus.AMENDMENT_REQUESTED) {
        const { allowedSections } = await getAmendmentAllowedSections(applicationId);
        const canRemoveAppUploadedFile =
          allowedSections.has("supporting_documents") || allowedSections.has("business_details");
        if (!canRemoveAppUploadedFile) {
          throw new AppError(403, "AMENDMENT_LOCKED", "This section is locked during amendment review");
        }
      }
    } else if (this.hasOfferBeenSent(application)) {
      const supportingKeys = this.extractS3KeysFromSupportingDocuments(
        application.supporting_documents
      );
      const acceptanceKeys = this.extractS3KeysFromAcceptanceDocuments(
        (application as { acceptance_documents?: unknown }).acceptance_documents
      );
      if (!supportingKeys.has(s3Key) && !acceptanceKeys.has(s3Key)) {
        throw new AppError(
          403,
          "EDIT_NOT_ALLOWED",
          "Only uploaded acceptance or supporting documents can be removed after an offer is sent"
        );
      }
      await this.assertPostApplicationPrepUnlocked(applicationId);
    } else {
      throw new AppError(403, "EDIT_NOT_ALLOWED", "Application cannot be edited in its current status");
    }

    if (shouldPreserveApplicationDocumentsInS3((application as { status?: string })?.status)) {
      logger.info(
        { applicationId, s3Key },
        "Skipped application document S3 delete: AMENDMENT_REQUESTED (preserve for compare/audit)"
      );
      return;
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
      await assertApplicationProcessingFeePaid(id);

      const financingTypeSubmit = application.financing_type as { product_id?: string } | null | undefined;
      const submitProductId = financingTypeSubmit?.product_id;
      let submitProductWorkflow: Prisma.JsonValue | undefined;
      if (submitProductId) {
        const submitProduct = await this.productRepository.findById(submitProductId);
        if (submitProduct?.workflow) {
          assertRequiredSupportingDocumentsPresent(
            submitProduct.workflow,
            application.supporting_documents
          );
          submitProductWorkflow = submitProduct.workflow as Prisma.JsonValue;
        }
      }
      const appFull = await prisma.application.findUnique({
        where: { id },
        include: {
          contract: true,
          invoices: true,
          issuer_organization: true,
          application_guarantors: { orderBy: { position: "asc" } },
        },
      });
      if (appFull) {
        const snapshot = buildApplicationRevisionSnapshot({
          financing_type: appFull.financing_type,
          product_version: appFull.product_version,
          product_workflow: submitProductWorkflow ?? null,
          amendment_acknowledged_workflow_ids: appFull.amendment_acknowledged_workflow_ids,
          financing_structure: appFull.financing_structure,
          company_details: appFull.company_details,
          business_details: appFull.business_details,
          application_guarantors: appFull.application_guarantors,
          financial_statements: appFull.financial_statements,
          supporting_documents: appFull.supporting_documents,
          declarations: appFull.declarations,
          review_and_submit: appFull.review_and_submit,
          last_completed_step: appFull.last_completed_step,
          contract_id: appFull.contract_id,
          contract: appFull.contract,
          invoices: appFull.invoices,
          issuer_organization: appFull.issuer_organization,
        });
        const revision = await (prisma as any).applicationRevision.create({
          data: {
            application_id: id,
            review_cycle: (appFull as any).review_cycle ?? 1,
            snapshot,
            submitted_at: new Date(),
          },
        });

        // Update org-level latest reusable financial statements for future app auto-prefill.
        // Only happens on submit (not draft save).
        await upsertLatestOrganizationFinancialStatementsFromApplication({
          applicationId: id,
          sourceApplicationRevisionId: revision?.id,
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
      await assertIssuerOrgDirectorShareholderOnboardingReady(application.issuer_organization_id);
      // Get product to find active steps
      const financingType = application.financing_type as any;
      const productId = financingType?.product_id;

      if (productId) {
        const product = await this.productRepository.findById(productId);
        if (product) {
          const workflow = Array.isArray(product.workflow) ? (product.workflow as { id?: unknown }[]) : [];
          /** Canonical keys only (same as issuer getStepKeyFromStepId); contract/invoice data live on relations, not JSON columns. */
          const activeStepKeys = new Set<string>();
          for (const step of workflow) {
            const stepId = typeof step?.id === "string" ? step.id.trim() : "";
            if (!stepId) continue;
            const base = stepId.replace(/_\d+$/, "");
            if (base === "verify_company_info") {
              activeStepKeys.add("company_details");
              continue;
            }
            const mapped = getStepKeyFromStepId(stepId);
            if (mapped) activeStepKeys.add(mapped);
          }

          const allStepColumns = [
            "financing_type",
            "financing_structure",
            "company_details",
            "business_details",
            "financial_statements",
            "supporting_documents",
            "declarations",
            "review_and_submit",
          ] as const;

          if (activeStepKeys.size === 0) {
            logger.warn(
              { applicationId: id, productId },
              "Submit cleanup skipped: product workflow has no usable step ids"
            );
          } else {
            for (const col of allStepColumns) {
              if (col === "financing_type") continue;
              if (!activeStepKeys.has(col)) {
                (updateData as any)[col] = Prisma.JsonNull;
              }
            }

            if (!activeStepKeys.has("contract_details") && application.contract_id) {
              (updateData as any).contract = { disconnect: true };
            }

            // Invoice rows live on `invoices`; no Application.invoice_details column. Deleting drafts here
            // was commented out to avoid accidental data loss — revisit if product removes invoice_details only.
          }
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
   * Reset acceptance-doc review items + section to PENDING on (re)submit, so a resubmitted
   * offer acceptance cannot reuse stale admin review decisions from a prior cycle.
   * Mirrors AdminService.resetAcceptanceReviewForNewOfferInTx.
   */
  private async resetAcceptanceDocumentsReviewInTx(
    tx: Prisma.TransactionClient,
    applicationId: string,
    application: {
      acceptance_documents?: unknown;
    },
    workflow: unknown[]
  ): Promise<void> {
    const docKeys = collectAcceptanceDocumentReviewKeys(
      workflow,
      application.acceptance_documents
    );
    for (const itemId of docKeys) {
      await tx.applicationReviewItem.upsert({
        where: {
          application_id_item_type_item_id: {
            application_id: applicationId,
            item_type: "document",
            item_id: itemId,
          },
        },
        create: {
          application_id: applicationId,
          item_type: "document",
          item_id: itemId,
          status: ReviewStepStatus.PENDING,
          reviewer_user_id: null,
          reviewed_at: null,
        },
        update: {
          status: ReviewStepStatus.PENDING,
          reviewer_user_id: null,
          reviewed_at: null,
        },
      });
    }
    if (docKeys.length === 0 && !workflowHasAcceptanceDocuments(workflow)) {
      return;
    }
    await tx.applicationReview.upsert({
      where: {
        application_id_section: {
          application_id: applicationId,
          section: "acceptance_documents",
        },
      },
      create: {
        application_id: applicationId,
        section: "acceptance_documents",
        status: ReviewStepStatus.PENDING,
        reviewer_user_id: null,
        reviewed_at: null,
      },
      update: {
        status: ReviewStepStatus.PENDING,
        reviewer_user_id: null,
        reviewed_at: null,
      },
    });
  }

  /**
   * Step 1 of offer acceptance: record acknowledgements + require acceptance uploads,
   * then move to PENDING_ADMIN_REVIEW (or APPROVED_FOR_SIGNING when no acceptance docs).
   */
  async submitContractOfferAcceptance(
    applicationId: string,
    userId: string,
    acknowledgementKeys: string[]
  ): Promise<Application> {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no contract");
    }
    const workflow = await this.getProductWorkflowForApplication(application);
    if (!workflowUsesOfferAcceptanceFlow(workflow)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        "This product does not use the offer acceptance flow."
      );
    }
    const contractId = application.contract_id;
    const requiredKeys = requiredOfferAcknowledgementKeys(workflow);
    const checked = new Set(acknowledgementKeys);
    for (const key of requiredKeys) {
      if (!checked.has(key)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "All required acknowledgements must be accepted before submitting."
        );
      }
    }
    assertRequiredAcceptanceDocumentsPresent(
      workflow,
      (application as { acceptance_documents?: unknown }).acceptance_documents
    );

    const now = new Date().toISOString();
    const nextStatus = resolveStatusAfterOfferAcceptanceSubmit(workflow);
    const allowedAcknowledgementKeys = resolveOfferAcknowledgementsFromWorkflow(workflow).map(
      (doc) => doc.key
    );

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { status: string; offer_details: Prisma.JsonValue | null }[]
      >`SELECT status, offer_details FROM contracts WHERE id = ${contractId} FOR UPDATE`;
      const contract = locked[0];
      if (!contract || contract.status !== "OFFER_SENT") {
        throw new AppError(400, "INVALID_STATE", "No pending contract offer to accept");
      }
      const offer = (contract.offer_details as Record<string, unknown> | null) ?? null;
      if (!offer) {
        throw new AppError(400, "INVALID_STATE", "Contract has no offer details");
      }
      const acceptance = getOfferAcceptanceFromOfferDetails(offer);
      if (!offerAcceptanceIsStep1Editable(acceptance?.status)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Offer acceptance has already been submitted or is not editable."
        );
      }
      const acknowledgements = mergeAcknowledgementRecords({
        existing: acceptance?.acknowledgements,
        documentKeys: [...checked],
        allowedKeys: allowedAcknowledgementKeys,
        userId,
        acceptedAt: now,
      });
      const updatedOffer = patchOfferAcceptance(offer, {
        status: nextStatus,
        acknowledgements,
        submitted_at: now,
        reviewed_at: nextStatus === "APPROVED_FOR_SIGNING" ? now : null,
        reviewed_by_user_id: nextStatus === "APPROVED_FOR_SIGNING" ? userId : null,
      });
      await tx.contract.update({
        where: { id: contractId },
        data: { offer_details: updatedOffer as Prisma.InputJsonValue },
      });
      await this.resetAcceptanceDocumentsReviewInTx(tx, applicationId, application, workflow);
    });

    return this.repository.findById(applicationId) as Promise<Application>;
  }

  async submitInvoiceOfferAcceptance(
    applicationId: string,
    invoiceId: string,
    userId: string,
    acknowledgementKeys: string[]
  ): Promise<Application> {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    const workflow = await this.getProductWorkflowForApplication(application);
    if (!workflowUsesOfferAcceptanceFlow(workflow)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        "This product does not use the offer acceptance flow."
      );
    }
    const invoices = (application as { invoices?: { id: string; contract_id?: string | null }[] }).invoices ?? [];
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found");
    }
    if (invoice.contract_id) {
      throw new AppError(
        400,
        "CONTRACT_LINKED_INVOICE_NO_PACKAGE",
        "Contract-linked invoice offers do not use the offer acceptance flow."
      );
    }
    const requiredKeys = requiredOfferAcknowledgementKeys(workflow);
    const checked = new Set(acknowledgementKeys);
    for (const key of requiredKeys) {
      if (!checked.has(key)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "All required acknowledgements must be accepted before submitting."
        );
      }
    }
    assertRequiredAcceptanceDocumentsPresent(
      workflow,
      (application as { acceptance_documents?: unknown }).acceptance_documents
    );

    const now = new Date().toISOString();
    const nextStatus = resolveStatusAfterOfferAcceptanceSubmit(workflow);
    const allowedAcknowledgementKeys = resolveOfferAcknowledgementsFromWorkflow(workflow).map(
      (doc) => doc.key
    );

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { status: string; offer_details: Prisma.JsonValue | null }[]
      >`SELECT status, offer_details FROM invoices WHERE id = ${invoiceId} AND application_id = ${applicationId} FOR UPDATE`;
      const row = locked[0];
      if (!row || row.status !== "OFFER_SENT") {
        throw new AppError(400, "INVALID_STATE", "No pending invoice offer to accept");
      }
      const offer = (row.offer_details as Record<string, unknown> | null) ?? null;
      if (!offer) {
        throw new AppError(400, "INVALID_STATE", "Invoice has no offer details");
      }
      const acceptance = getOfferAcceptanceFromOfferDetails(offer);
      if (!offerAcceptanceIsStep1Editable(acceptance?.status)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Offer acceptance has already been submitted or is not editable."
        );
      }
      const acknowledgements = mergeAcknowledgementRecords({
        existing: acceptance?.acknowledgements,
        documentKeys: [...checked],
        allowedKeys: allowedAcknowledgementKeys,
        userId,
        acceptedAt: now,
      });
      const updatedOffer = patchOfferAcceptance(offer, {
        status: nextStatus,
        acknowledgements,
        submitted_at: now,
        reviewed_at: nextStatus === "APPROVED_FOR_SIGNING" ? now : null,
        reviewed_by_user_id: nextStatus === "APPROVED_FOR_SIGNING" ? userId : null,
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { offer_details: updatedOffer as Prisma.InputJsonValue },
      });
      await this.resetAcceptanceDocumentsReviewInTx(tx, applicationId, application, workflow);
    });

    return this.repository.findById(applicationId) as Promise<Application>;
  }

  /**
   * Accept or reject a contract offer. Issuer must be a member of the application's organization.
   */
  /**
   * Phased offer products must complete via envelope (or non-prod skipSigning bypass).
   * Prevents silent direct accept when SigningCloud env is missing/misconfigured.
   */
  private async assertPhasedOfferDirectAcceptBlocked(params: {
    application: Application;
    action: "accept" | "reject";
    signingCompletion?: { signedOfferLetterS3Key: string; signedFileSha256: string };
    allowDevSigningBypass?: boolean;
    invoiceId?: string;
  }): Promise<void> {
    if (params.action !== "accept") return;
    if (params.signingCompletion) return;
    if (params.allowDevSigningBypass) return;

    const workflow = await this.getProductWorkflowForApplication(params.application);
    if (!workflowUsesOfferAcceptanceFlow(workflow)) return;

    if (params.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: params.invoiceId, application_id: params.application.id },
        select: { contract_id: true },
      });
      if (invoice?.contract_id) {
        const completed = await prisma.signingEnvelope.findFirst({
          where: { contract_id: invoice.contract_id, status: "COMPLETED" },
          select: { id: true },
        });
        if (completed) return;
        throw new AppError(
          400,
          "CONTRACT_SIGNING_INCOMPLETE",
          "Finish contract signing before accepting this invoice offer."
        );
      }
    }

    throw new AppError(
      400,
      "SIGNING_NOT_CONFIGURED",
      "This offer must be completed through the signing package. Signing is not available — contact CashSouk."
    );
  }

  async respondToContractOffer(
    applicationId: string,
    action: "accept" | "reject",
    userId: string,
    rejectionReason?: string,
    options?: {
      signingCompletion?: { signedOfferLetterS3Key: string; signedFileSha256: string };
      allowDevSigningBypass?: boolean;
    }
  ): Promise<Application> {
    await this.verifyApplicationAccess(applicationId, userId);

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no contract");
    }
    await this.assertPhasedOfferDirectAcceptBlocked({
      application,
      action,
      signingCompletion: options?.signingCompletion,
      allowDevSigningBypass: options?.allowDevSigningBypass,
    });
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

      const now = new Date().toISOString();
      /** Issuer rejecting offer = withdraw financing request. Admin reject = REJECTED. */
      const newStatus = action === "accept" ? "APPROVED" : "WITHDRAWN";
      const offeredFacility = Number(offer.offered_facility) || 0;
      const requestedFacility = Number(offer.requested_facility) || 0;
      const facilityFeeRatePercentRaw =
        typeof offer.facility_fee_rate_percent === "number" ? offer.facility_fee_rate_percent : 0;
      const facilityFeeRatePercent = Number.isFinite(facilityFeeRatePercentRaw)
        ? facilityFeeRatePercentRaw
        : 0;

      let updatedOffer: Record<string, unknown> = {
        ...offer,
        responded_at: now,
        responded_by_user_id: userId,
        ...(action === "reject" && rejectionReason != null && rejectionReason.trim() !== ""
          ? { rejection_reason: rejectionReason.trim() }
          : {}),
      };
      if (getOfferAcceptanceFromOfferDetails(updatedOffer)) {
        updatedOffer = patchOfferAcceptance(updatedOffer, {
          status: action === "accept" ? "COMPLETED" : "DECLINED",
        });
      }

      const cd = (contract.contract_details as Record<string, unknown>) || {};
      const utilizedFacility = typeof cd.utilized_facility === "number" ? cd.utilized_facility : 0;
      const mergedDetails =
        action === "accept"
          ? {
            ...cd,
            approved_facility: offeredFacility,
            utilized_facility: utilizedFacility,
            available_facility: offeredFacility - utilizedFacility,
            facility_fee_rate_percent: facilityFeeRatePercent,
            facility_fee_paid_amount:
              typeof cd.facility_fee_paid_amount === "number" && Number.isFinite(cd.facility_fee_paid_amount)
                ? (cd.facility_fee_paid_amount as number)
                : 0,
          }
          : cd;

      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: newStatus,
          offer_details: updatedOffer as Prisma.InputJsonValue,
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

      // Primary offer ceremony complete → Acceptance section APPROVED (alongside Contract).
      if (action === "accept" && getOfferAcceptanceFromOfferDetails(offer)) {
        await tx.applicationReview.upsert({
          where: {
            application_id_section: {
              application_id: applicationId,
              section: "acceptance_documents",
            },
          },
          create: {
            application_id: applicationId,
            section: "acceptance_documents",
            status: ReviewStepStatus.APPROVED,
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
          update: {
            status: ReviewStepStatus.APPROVED,
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
        });
      }

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
      const isInvoiceOnly =
        (application as { financing_structure?: { structure_type?: string } }).financing_structure
          ?.structure_type === "invoice_only";
      const appStatus = computeApplicationStatus(
        updatedContract as { status: ContractStatus } | null,
        updatedInvoices.map((i) => ({ status: i.status as InvoiceStatus })),
        nextReviewStatusBase,
        { isInvoiceOnly }
      );
      await tx.application.update({
        where: { id: applicationId },
        data: { status: appStatus as unknown as DbApplicationStatus },
      });
      /* --- END: Recompute and persist application status after contract offer response --- */

      return { offeredFacility, requestedFacility, now, appStatus };
    });

    const eventType =
      action === "accept" ? "CONTRACT_OFFER_ACCEPTED" : "CONTRACT_WITHDRAWN";
    const contractNumber = (
      application as {
        contract?: { contract_details?: { number?: string | number } | null } | null;
      }
    ).contract?.contract_details?.number;

    await logApplicationActivity({
      userId,
      applicationId,
      entityId: application.contract_id ?? undefined,
      portal: ActivityPortal.ISSUER,
      eventType,
      metadata: {
        ...(application.contract_id ? { contract_id: application.contract_id } : {}),
        ...(contractNumber != null && String(contractNumber).trim() !== ""
          ? { contract_number: String(contractNumber).trim() }
          : {}),
        offered_facility: responseMeta.offeredFacility,
        requested_facility: responseMeta.requestedFacility,
        responded_at: responseMeta.now,
        ...(action === "reject" && rejectionReason != null && rejectionReason.trim() !== ""
          ? { rejection_reason: rejectionReason.trim() }
          : {}),
      },
    });
    if (responseMeta.appStatus === ApplicationStatus.WITHDRAWN) {
      try {
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.APPLICATION_WITHDRAWN_CONFIRMATION,
          { applicationId },
          "withdrawn:contract-offer-response"
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId },
          "Failed to send application withdrawn confirmation notification (contract flow)"
        );
      }
    }
    if (responseMeta.appStatus === ApplicationStatus.COMPLETED) {
      await logApplicationActivity({
        userId,
        applicationId,
        eventType: "APPLICATION_COMPLETED",
        portal: ActivityPortal.ISSUER,
      });
      try {
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.APPLICATION_COMPLETED,
          { applicationId },
          "completed:contract-flow"
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId },
          "Failed to send application completed notification (contract flow)"
        );
      }
    }

    const updated = await this.repository.findById(applicationId);
    if (!updated) throw new AppError(500, "INTERNAL_ERROR", "Failed to load updated application");
    return updated;
  }

  /**
   * Accept or reject an invoice offer. Issuer must be a member of the application's organization.
   */
  /**
   * When SigningCloud is configured, invoice accept is allowed without an envelope only for
   * contract-linked invoices whose contract offer signing package is COMPLETED.
   * Throws USE_SIGNING_FLOW (invoice-only) or CONTRACT_SIGNING_INCOMPLETE (linked, not done).
   */
  async assertInvoiceOfferAcceptAllowed(
    applicationId: string,
    invoiceId: string,
    userId: string
  ): Promise<void> {
    // Authz first so eligibility codes cannot leak offer/signing state to strangers.
    await this.verifyApplicationAccess(applicationId, userId);

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, application_id: applicationId },
      select: { contract_id: true },
    });
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found in this application");
    }

    const invoiceContractId = invoice.contract_id;
    let hasCompletedContractEnvelope = false;
    if (invoiceContractId) {
      const completed = await prisma.signingEnvelope.findFirst({
        where: { contract_id: invoiceContractId, status: "COMPLETED" },
        select: { id: true },
      });
      hasCompletedContractEnvelope = completed != null;
    }

    if (
      canDirectAcceptInvoice({
        invoiceContractId,
        hasCompletedContractEnvelope,
      })
    ) {
      return;
    }

    if (invoiceContractId) {
      throw new AppError(
        400,
        "CONTRACT_SIGNING_INCOMPLETE",
        "Finish contract signing before accepting this invoice offer."
      );
    }

    throw new AppError(
      400,
      "USE_SIGNING_FLOW",
      "Complete signing via the signing envelope before accepting this offer."
    );
  }

  async respondToInvoiceOffer(
    applicationId: string,
    invoiceId: string,
    action: "accept" | "reject",
    userId: string,
    rejectionReason?: string,
    options?: {
      signingCompletion?: { signedOfferLetterS3Key: string; signedFileSha256: string };
      allowDevSigningBypass?: boolean;
    }
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
    await this.assertPhasedOfferDirectAcceptBlocked({
      application,
      action,
      signingCompletion: options?.signingCompletion,
      allowDevSigningBypass: options?.allowDevSigningBypass,
      invoiceId,
    });

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

      const now = new Date().toISOString();
      /** Issuer rejecting offer = withdraw financing request. Admin reject = REJECTED. */
      const newStatus = action === "accept" ? "APPROVED" : "WITHDRAWN";
      const offeredAmount = Number(offer.offered_amount) || 0;
      const requestedAmount = Number(offer.requested_amount) || 0;

      let updatedOffer: Record<string, unknown> = {
        ...offer,
        responded_at: now,
        responded_by_user_id: userId,
        ...(action === "reject" && rejectionReason != null && rejectionReason.trim() !== ""
          ? { rejection_reason: rejectionReason.trim() }
          : {}),
      };
      if (getOfferAcceptanceFromOfferDetails(updatedOffer)) {
        updatedOffer = patchOfferAcceptance(updatedOffer, {
          status: action === "accept" ? "COMPLETED" : "DECLINED",
        });
      }

      await tx.invoice.update({
        where: { id: invoiceId, application_id: applicationId },
        data: {
          status: newStatus,
          offer_details: updatedOffer as Prisma.InputJsonValue,
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

      // Invoice-only primary offer ceremony complete → Acceptance section APPROVED.
      if (action === "accept" && getOfferAcceptanceFromOfferDetails(offer)) {
        await tx.applicationReview.upsert({
          where: {
            application_id_section: {
              application_id: applicationId,
              section: "acceptance_documents",
            },
          },
          create: {
            application_id: applicationId,
            section: "acceptance_documents",
            status: ReviewStepStatus.APPROVED,
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
          update: {
            status: ReviewStepStatus.APPROVED,
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
        });
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
      const isInvoiceOnly =
        (application as { financing_structure?: { structure_type?: string } }).financing_structure
          ?.structure_type === "invoice_only";
      const appStatus = computeApplicationStatus(
        updatedContract as { status: ContractStatus } | null,
        invoiceStatuses.map((status) => ({ status })),
        nextReviewStatusBase,
        { isInvoiceOnly }
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
      entityId: invoiceId,
      portal: ActivityPortal.ISSUER,
      eventType,
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        offered_amount: responseMeta.offeredAmount,
        requested_amount: responseMeta.requestedAmount,
        responded_at: responseMeta.now,
        ...(action === "reject" && rejectionReason != null && rejectionReason.trim() !== ""
          ? { rejection_reason: rejectionReason.trim() }
          : {}),
      },
    });
    if (responseMeta.appStatus === ApplicationStatus.WITHDRAWN) {
      try {
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.APPLICATION_WITHDRAWN_CONFIRMATION,
          { applicationId },
          "withdrawn:invoice-offer-response"
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId },
          "Failed to send application withdrawn confirmation notification (invoice flow)"
        );
      }
    }
    if (responseMeta.appStatus === ApplicationStatus.COMPLETED) {
      await logApplicationActivity({
        userId,
        applicationId,
        eventType: "APPLICATION_COMPLETED",
        portal: ActivityPortal.ISSUER,
      });
      try {
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.APPLICATION_COMPLETED,
          { applicationId },
          "completed:invoice-flow"
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId },
          "Failed to send application completed notification (invoice flow)"
        );
      }
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
      facility_fee_rate_percent: Number(offer.facility_fee_rate_percent) || undefined,
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
      select: { status: true, offer_details: true, contract_id: true },
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

    let facilityFeeRatePercent: number | undefined;
    let facilityFeeCapAmount: number | undefined;
    if (dbInvoice.contract_id) {
      const contract = await prisma.contract.findUnique({
        where: { id: dbInvoice.contract_id },
        select: { contract_details: true },
      });
      const cd = (contract?.contract_details as Record<string, unknown> | null) ?? null;
      const rate = Number(cd?.facility_fee_rate_percent);
      const approvedFacility = Number(cd?.approved_facility);
      if (Number.isFinite(rate) && rate > 0) {
        facilityFeeRatePercent = rate;
        if (Number.isFinite(approvedFacility) && approvedFacility > 0) {
          facilityFeeCapAmount = approvedFacility * (rate / 100);
        }
      }
    }

    const offerDetails: InvoiceOfferDetails = {
      requested_amount: Number(offer.requested_amount) || undefined,
      offered_amount: Number(offer.offered_amount) || undefined,
      offered_ratio_percent: Number(offer.offered_ratio_percent) || undefined,
      offered_profit_rate_percent: Number(offer.offered_profit_rate_percent) || undefined,
      platform_fee_rate_percent: resolveOfferedPlatformFeeRatePercent(offer),
      facility_fee_rate_percent: facilityFeeRatePercent,
      facility_fee_cap_amount: facilityFeeCapAmount,
      expires_at: typeof offer.expires_at === "string" ? offer.expires_at : undefined,
    };

    const stream = generateInvoiceOfferLetterStream(invoiceId, offerDetails);
    const filename = `invoice-offer-${invoiceId}.pdf`;
    return { stream, filename };
  }

  private async resolveSignedOfferLetterS3KeyFromEnvelope(params: {
    applicationId: string;
    contractId?: string | null;
    invoiceId?: string | null;
  }): Promise<string> {
    const envelope = await prisma.signingEnvelope.findFirst({
      where: {
        application_id: params.applicationId,
        status: "COMPLETED",
        ...(params.contractId ? { contract_id: params.contractId } : {}),
        ...(params.invoiceId ? { invoice_id: params.invoiceId } : {}),
      },
      include: {
        documents: {
          where: { source: "GENERATED_OFFER_LETTER" },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { completed_at: "desc" },
    });

    const signedDocument = envelope?.documents.find((document) => document.signed_s3_key?.trim());
    const key = signedDocument?.signed_s3_key?.trim();
    if (!key) {
      throw new AppError(400, "INVALID_STATE", "Signed offer letter is not available");
    }
    return key;
  }


  async finalizeOfferAfterEnvelopeCompletion(input: {
    applicationId: string;
    contractId?: string | null;
    invoiceId?: string | null;
    initiatedByUserId: string;
    signedOfferLetterS3Key: string;
    signedFileSha256: string;
  }): Promise<{ skipped: boolean }> {
    if (!input.invoiceId && !input.contractId) {
      throw new AppError(400, "INVALID_STATE", "Signing envelope is not linked to an offer.");
    }

    try {
      if (input.invoiceId) {
        await this.respondToInvoiceOffer(
          input.applicationId,
          input.invoiceId,
          "accept",
          input.initiatedByUserId,
          undefined,
          {
            signingCompletion: {
              signedOfferLetterS3Key: input.signedOfferLetterS3Key,
              signedFileSha256: input.signedFileSha256,
            },
          }
        );
        return { skipped: false };
      }

      if (input.contractId) {
        await this.respondToContractOffer(
          input.applicationId,
          "accept",
          input.initiatedByUserId,
          undefined,
          {
            signingCompletion: {
              signedOfferLetterS3Key: input.signedOfferLetterS3Key,
              signedFileSha256: input.signedFileSha256,
            },
          }
        );
        return { skipped: false };
      }
    } catch (e) {
      if (
        e instanceof AppError &&
        (e.code === "ALREADY_RESPONDED" || e.code === "INVALID_STATE")
      ) {
        return { skipped: true };
      }
      throw e;
    }
    throw new AppError(400, "INVALID_STATE", "Signing envelope is not linked to an offer.");
  }

  /**
   * Signed contract offer letter PDF bytes (from S3). Requires issuer access and completed signing.
   */
  async getSignedContractOfferLetterBuffer(
    applicationId: string,
    userId: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    await this.verifyApplicationAccess(applicationId, userId);

    const application = await this.repository.findById(applicationId);
    if (!application?.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no contract");
    }

    const key = await this.resolveSignedOfferLetterS3KeyFromEnvelope({
      applicationId,
      contractId: application.contract_id,
    });
    const buffer = await getS3ObjectBuffer(key);
    return { buffer, filename: `signed-contract-offer-${application.contract_id}.pdf` };
  }

  /**
   * Signed invoice offer letter PDF bytes (from S3).
   */
  async getSignedInvoiceOfferLetterBuffer(
    applicationId: string,
    invoiceId: string,
    userId: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    await this.verifyApplicationAccess(applicationId, userId);

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    const invoices = (application as { invoices?: { id: string }[] }).invoices ?? [];
    if (!invoices.some((i) => i.id === invoiceId)) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found in this application");
    }

    const key = await this.resolveSignedOfferLetterS3KeyFromEnvelope({
      applicationId,
      invoiceId,
    });
    const buffer = await getS3ObjectBuffer(key);
    return { buffer, filename: `signed-invoice-offer-${invoiceId}.pdf` };
  }
}

export const applicationService = new ApplicationService();
