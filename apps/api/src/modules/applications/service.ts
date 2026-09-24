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
  businessDetailsInheritedGuarantorsDataSchema,
  financialStatementsInputSchema,
} from "./schemas";
import { parseFinancialStatementsForStepSave } from "./financial-statements-save";
import { AppError } from "../../lib/http/error-handler";
import { preserveLegacyAboutYourBusinessFields } from "./preserve-about-your-business";
import {
  Application,
  Prisma,
  ApplicationStatus as DbApplicationStatus,
  ProductStatus,
  ReviewStepStatus,
} from "@prisma/client";
import { requestPresignedUploadUrl, deleteDocumentFromS3 } from "./documents/service";
import { shouldPreserveApplicationDocumentsInS3 } from "./amendment-preserve-s3";
import { legalDocumentAcceptanceService } from "../legal-documents/acceptance-service";
import {
  assertRequiredSupportingDocumentsPresent,
  assertRequiredAcceptanceDocumentsPresent,
  fileNameToSupportingDocTypeToken,
  getGuarantorAgreementAllowedTypesFromProductWorkflow,
  getSupportingDocAllowedTypesFromProductWorkflow,
  assertSupportingDocCategoryNotFacilityLocked,
} from "./supporting-docs-workflow";
import {
  resolveAcceptanceDocumentAllowedTypes,
  resolveAcceptanceDocumentsFromWorkflow,
  collectAcceptanceDocumentReviewKeys,
  workflowHasAcceptanceDocuments,
  getOfferAcceptanceFromOfferDetails,
  offerAcceptanceIsStep1Editable,
  resolveStatusAfterOfferAcceptanceSubmit,
  workflowUsesOfferAcceptanceFlow,
  workflowShowsAcceptanceReviewSection,
  buildAcknowledgedTermsSnapshot,
  stampAuthorizedPartiesSnapshot,
  summarizeAuthorizedParties,
  collectAuthorizedRepresentativeReviewKeys,
  type AuthorizedPartiesSnapshot,
  type AuthorizedPartiesSubmitPayload,
  canonicalDownloadFilenameToken,
  pickPrimarySignedOfferDocument,
} from "@cashsouk/types";
import { patchOfferAcceptance } from "./offer-acceptance";
import { assertAcceptanceDeadlineOpen, assertSigningDeadlineOpen } from "../../lib/phase-deadlines";
import {
  assertAcceptanceDocumentIndexEditableInChangesRequested,
  collectFlaggedAcceptanceDocumentIndices,
  findAcceptanceDocumentIndexForS3Key,
  findChangedAcceptanceDocumentIndices,
  resolveAcceptanceDocumentReviewKeysToResetOnSubmit,
} from "./acceptance-document-issuer-lock";
import {
  assertSupportingDocumentSlotEditable,
  findChangedSupportingDocumentSlots,
  findSupportingDocumentSlotForS3Key,
  hasSupportingDocumentItemLocks,
} from "./supporting-document-issuer-lock";
import {
  AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
  assertUnflaggedAuthorizedPartiesUnchanged,
  authorizedRepresentativeReviewItemIdRemap,
  collectFlaggedAuthorizedRepresentativeItemIds,
  resolveAuthorizedRepresentativeReviewKeysToResetOnSubmit,
} from "./authorized-representatives-review";
import {
  applicationGuarantorsForParties,
  assertAuthorizedPartiesForOffer,
  loadIssuerDirectorPool,
  type ApplicationGuarantorForParties,
} from "./authorized-parties";
import {
  flaggedIndividualGuarantorParties,
  identityFromIndividualGuarantorParty,
  buildIndividualGuarantorIdentityPatch,
  prismaDataForIndividualGuarantorIdentityPatch,
} from "./individual-guarantor-identity";
import { buildApplicationRevisionSnapshot } from "./revision-snapshot";
import { assertProductRulesForSubmit } from "./product-rules-on-submit";
import {
  mergeApplicationAdminFinancialSupplementsIntoOrg,
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
import { linkPaymasterForApplicationSubmission } from "../paymaster/service";
import { prisma } from "../../lib/prisma";
import { loadUserDisplayNameMap } from "../../lib/user-display-name";
import { logApplicationActivity } from "./logs/service";
import { logApplicationFlowEvent, logApplicationStepAction, safeServerErrorMessage } from "./application-flow-logger";
import {
  ActivityPortal,
  ApplicationLogEventType,
  type IssuerActivityLogContext,
} from "./logs/types";
import { assertApplicationProcessingFeePaid } from "../payment/processing-fee-service";
import {
  generateContractOfferLetterStream,
  generateInvoiceOfferLetterStream,
  invoiceOfferLetterKindForContract,
  buildInvoiceOfferLetterDto,
  type ContractOfferDetails,
} from "./offer-letter-pdf";
import {
  composeApplicationSummary,
  buildApplicationSummaryHtml,
  renderApplicationSummaryHtmlToPdfBuffer,
  type ComposeApplicationSummaryInput,
} from "./summary-pdf";
import { applyContractCapacityChange, lockContractRow } from "../../lib/refresh-contract-facility";
import {
  attachInheritedFacilityGuarantors,
  attachInheritedFacilitySupportingDocuments,
  loadInheritedGuarantorsForExistingContract,
  loadInheritedSupportingDocumentsForExistingContract,
} from "../../lib/contract-originating-application";
import { assertFacilityFeeUpfrontSettled } from "../../lib/facility-fee-upfront-guard";
import {
  resolveContractValue,
  resolveOfferedFacility,
  resolveRequestedFacility,
} from "../../lib/contract-facility";
import { assertFacilityBelowContractValue } from "../../lib/contract-capacity-errors";
import {
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  WithdrawReason,
  canDirectAcceptInvoice,
  canArchiveApplication,
  canWithdrawApplication,
  APPLICATION_COMREP_DETAIL_KEYS,
  applicationComrepFieldError,
  buildStoredApplicationFinancialYearBlock,
  financialYearBlockHasActualData,
  getFinancialYearEndComputationDetails,
  getFinancialYearEndValidationError,
  getEligibleAdminInputYears,
  decideAdminFinancialFieldEdit,
  parseAdminFieldOverrides,
  FINANCIAL_FIELD_LABELS,
  reconcileAdminFieldOverridesAfterIssuerSave,
  resolveAdminFinancialReviewColumns,
  issuerUnauditedPlddForFyEndYear,
  getReviewSectionPrerequisites,
  getStepKeyFromStepId,
  hasActionableDirectorShareholder,
  preserveSplitOriginationMarker,
  withSplitOriginationMarker,
  computeFacilityFeeTotalOwed,
  parseFiniteNumber,
  parseInvoiceFeeSchedule,
  buildUtilisationOfferConsentAcknowledgement,
  isInvoiceOnlyFinancingStructure,
  readFinancingStructureType,
  roundNoteMoney,
  isInheritedFacilityGuarantorReview,
  FACILITY_GUARANTORS_REQUIRED,
  FACILITY_LOCKED_SUPPORTING_DOCUMENTS_MESSAGE,
  collectSupportingDocumentS3Keys,
  facilityLockedSupportingDocumentsChanged,
  getFacilityLockedCategoriesFromWorkflow,
  stripFacilityLockedSupportingDocuments,
} from "@cashsouk/types";
import { resolveInvoiceOccupancyContractId } from "../../lib/standalone-holder-contract";
import {
  consumeOfferAcceptOtpInTx,
  incrementOfferAcceptOtpAttempts,
  invoiceOfferAcceptRequiresOtp,
  isOfferAcceptOtpInvalidError,
  matchOfferAcceptSignatory,
  persistAndSendOfferAcceptOtp,
  resolveOfferAcceptEnvelopeSignatories,
  resolveOfferAcceptSignatories,
  type AcceptedOfferSignatory,
} from "./offer-accept-otp";
import { computeApplicationStatus } from "./lifecycle";
import {
  resolveApplicationStatusAfterCommercialAccept,
  resolveApplicationStatusAfterOfferAcceptanceSubmit,
} from "./offer-application-status";
import { getS3ObjectBuffer } from "../../lib/s3/client";
import { NotificationService } from "../notification/service";
import { NotificationTypeIds } from "../notification/registry";
import { systemNotificationLogKey } from "../notification/delivery-log";
import { getIssuerRecipientUserIdsForApplication } from "../notification/application-recipients";
import { sendTypedToUsersSafe } from "../notification/send-typed-safe";
import { parseGuarantorsFromBusinessDetails } from "../guarantors/utils";
import { assertIssuerOrgDirectorShareholderOnboardingReady } from "./director-shareholder-onboarding-guard";
import {
  assertFinancialStatementsReadyForInitialSubmitIfActive,
  assertRequiredFinancialFieldsForInitialSubmit,
} from "./financial-statements-submit-guard";
import { assertIssuerProfileCompleteForSubmit } from "../organization-profile/service";
import { buildAdminPeopleList } from "../admin/build-people-list";
import {
  allocateDisplayReference,
  resolveApplicationProductCode,
} from "../../lib/display-reference";
import {
  enrichApplicationOriginationFields,
  resolveApplicationOriginationPhase,
} from "./origination-guards";
import {
  SIGNING_ENVELOPE_OFFER_SUMMARY_SELECT,
  groupSigningEnvelopeOfferSummariesByApplication,
  toSigningEnvelopeOfferSummaries,
} from "./signed-offer-envelope-summary";
import {
  overlayReadCapacityOnApplicationContract,
  overlayReadCapacityOnApplications,
} from "../../lib/refresh-contract-facility";
import {
  assertApplicationSubmitOrigination,
  assertExistingFacilityDrawdown,
} from "./split-origination-guards";
import { assertFacilityLinkedInvoiceAcceptFees } from "../../lib/facility-fee-collect-reservation";
import { assertRequiredFinancialComrepFieldsPresentOrThrow } from "./financial-comrep-requiredness";

function financialToNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function isFinalApplicationStatus(status: string | null | undefined): boolean {
  return (
    status === "COMPLETED" ||
    status === "REJECTED" ||
    status === "WITHDRAWN" ||
    status === "ARCHIVED"
  );
}

/** Business rules for v2 per-year financial blocks (no bsdd). Core fields unchanged. */
function validateFinancialYearBlockOrThrow(raw: Record<string, unknown>): void {
  const nonNegativeFields: { key: string; label: string }[] = [
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

  assertRequiredFinancialComrepFieldsPresentOrThrow(raw);

  for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
    const message = applicationComrepFieldError(key, raw[key]);
    if (message) {
      throw new AppError(400, "VALIDATION_ERROR", message);
    }
  }
}

function normalizeFinancialYearBlock(raw: Record<string, unknown>): Prisma.InputJsonValue {
  return buildStoredApplicationFinancialYearBlock(raw) as Prisma.InputJsonValue;
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

  /**
   * Financing structure is the branch point. When the branch changes, clear
   * path-specific draft invoices / draft holder contracts (and their S3 objects).
   * Shared approved contracts are only unlinked, never deleted.
   */
  private async resetFinancingStructureBranchData(
    application: Application & {
      invoices?: Array<{ id: string; status: string; details: unknown }>;
      status?: string;
      contract_id?: string | null;
    }
  ): Promise<void> {
    const invoices = application.invoices ?? [];
    const nonDraftInvoices = invoices.filter((invoice) => invoice.status !== "DRAFT");
    if (nonDraftInvoices.length > 0) {
      throw new AppError(
        400,
        "STRUCTURE_CHANGE_BLOCKED",
        "Cannot change financing structure after invoices have progressed beyond draft."
      );
    }

    const preserveS3 = shouldPreserveApplicationDocumentsInS3(application.status);
    const extractDocS3Key = (details: unknown): string | null => {
      if (!details || typeof details !== "object") return null;
      const document = (details as { document?: { s3_key?: unknown } }).document;
      const key = document?.s3_key;
      return typeof key === "string" && key.trim() ? key.trim() : null;
    };

    for (const invoice of invoices) {
      const s3Key = extractDocS3Key(invoice.details);
      await prisma.invoice.delete({ where: { id: invoice.id } });
      if (s3Key && !preserveS3) {
        try {
          await deleteS3Object(s3Key);
        } catch (err) {
          logger.error(
            { applicationId: application.id, invoiceId: invoice.id, s3Key, err },
            "Failed to delete invoice S3 object during financing structure reset"
          );
        }
      } else if (s3Key && preserveS3) {
        logger.info(
          { applicationId: application.id, invoiceId: invoice.id, s3Key },
          "Skipped invoice S3 delete during structure reset: AMENDMENT_REQUESTED preserve"
        );
      }
    }

    if (!application.contract_id) return;

    const contract = await this.contractRepository.findById(application.contract_id);
    await prisma.application.update({
      where: { id: application.id },
      data: { contract_id: null },
    });

    // Approved (existing-contract) links are only disconnected. Draft holder contracts
    // created in the new_contract / invoice-only path are deleted with their documents.
    if (!contract || contract.status !== "DRAFT") return;

    const linkedApps =
      (
        contract as {
          applications?: Array<{ id: string }>;
        }
      ).applications ?? [];
    const otherLinkedApps = linkedApps.filter((app) => app.id !== application.id);
    if (otherLinkedApps.length > 0) {
      logger.warn(
        { applicationId: application.id, contractId: contract.id, otherLinkedApps },
        "Skipped draft contract delete during structure reset: still linked to other applications"
      );
      return;
    }

    const s3Keys = [
      extractDocS3Key(contract.contract_details),
      extractDocS3Key(contract.customer_details),
    ].filter((key): key is string => Boolean(key));

    await this.contractRepository.delete(contract.id);

    if (preserveS3) {
      for (const s3Key of s3Keys) {
        logger.info(
          { applicationId: application.id, contractId: contract.id, s3Key },
          "Skipped contract S3 delete during structure reset: AMENDMENT_REQUESTED preserve"
        );
      }
      return;
    }

    for (const s3Key of s3Keys) {
      try {
        await deleteS3Object(s3Key);
      } catch (err) {
        logger.error(
          { applicationId: application.id, contractId: contract.id, s3Key, err },
          "Failed to delete contract S3 object during financing structure reset"
        );
      }
    }
  }

  private async sendIssuerNotification(
    applicationId: string,
    typeId: (typeof NotificationTypeIds)[keyof typeof NotificationTypeIds],
    payload: Record<string, unknown>,
    idempotencySuffix: string
  ) {
    const recipientUserIds = await getIssuerRecipientUserIdsForApplication(applicationId);
    if (recipientUserIds.length === 0) {
      return;
    }
    const enrichedPayload = await this.enrichApplicationNotificationPayload(applicationId, payload);
    const results = await sendTypedToUsersSafe(
      this.notificationService,
      recipientUserIds,
      typeId as never,
      enrichedPayload as never,
      (userId) => `app:${applicationId}:notif:${typeId}:user:${userId}:${idempotencySuffix}`
    );
    await this.notificationService.logTypedSystemBatch(
      typeId as never,
      enrichedPayload as never,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          typeId,
          `app:${applicationId}:${idempotencySuffix}`
        ),
      }
    );
  }

  private async enrichApplicationNotificationPayload(
    applicationId: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!("applicationId" in payload)) {
      return payload;
    }
    const displayReference = payload.displayReference;
    if (typeof displayReference === "string" && displayReference.trim().length > 0) {
      return payload;
    }
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { display_reference: true },
    });
    return {
      ...payload,
      displayReference: application?.display_reference ?? null,
    };
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
          name: row.guarantorType === "individual" ? (row.name ?? null) : null,
          ic_number: row.guarantorType === "individual" ? (row.icNumber ?? null) : null,
          business_name: row.guarantorType === "company" ? (row.businessName ?? null) : null,
          ssm_number: row.guarantorType === "company" ? (row.ssmNumber ?? null) : null,
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
      financing_type_1: "financing_type",
      financing_structure_1: "financing_structure",
      company_details_1: "company_details",
      verify_company_info_1: "company_details",
      business_details_1: "business_details",
      financial_statements_1: "financial_statements",
      supporting_documents_1: "supporting_documents",
      acceptance_documents_1: "acceptance_documents",
      declarations_1: "declarations",
      review_and_submit_1: "review_and_submit",
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
      throw new AppError(
        403,
        "EDIT_NOT_ALLOWED",
        "Application cannot be edited in its current status"
      );
    }
  }

  private hasOfferBeenSent(application: Application | null): boolean {
    if (!application) return false;
    const status = (application as { status?: string }).status;
    if (
      status === ApplicationStatus.CONTRACT_SENT ||
      status === ApplicationStatus.INVOICES_SENT ||
      status === ApplicationStatus.OFFER_EXPIRED ||
      status === ApplicationStatus.CONTRACT_ACCEPTED ||
      status === ApplicationStatus.INVOICE_ACCEPTED ||
      status === ApplicationStatus.SIGNING_PENDING ||
      status === ApplicationStatus.COMPLETED
    ) {
      return true;
    }
    const contract = (application as { contract?: { status?: string } | null }).contract;
    if (
      contract?.status === ContractStatus.OFFER_SENT ||
      contract?.status === ContractStatus.OFFER_EXPIRED
    ) {
      return true;
    }
    const invoices = (application as { invoices?: Array<{ status?: string }> }).invoices ?? [];
    return invoices.some(
      (invoice) =>
        invoice.status === InvoiceStatus.OFFER_SENT ||
        invoice.status === InvoiceStatus.OFFER_EXPIRED
    );
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

  private collectMutableIndividualGuarantorItemIds(application: Application): Set<string> {
    if (this.resolveOfferAcceptancePhase(application) !== "CHANGES_REQUESTED") {
      return new Set();
    }
    return collectFlaggedAuthorizedRepresentativeItemIds(
      (
        application as {
          application_review_items?: {
            item_type: string;
            item_id: string;
            status: string;
          }[];
        }
      ).application_review_items
    );
  }

  private resolveOfferAcceptancePhase(application: Application | null): string | null | undefined {
    if (!application) return null;
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
    return getOfferAcceptanceFromOfferDetails(offer)?.status ?? null;
  }

  private getFlaggedAcceptanceDocumentIndices(application: Application | null): Set<number> {
    const reviewItems = (
      application as {
        application_review_items?: {
          item_type: string;
          item_id: string;
          status: string;
        }[];
      } | null
    )?.application_review_items;
    return collectFlaggedAcceptanceDocumentIndices(reviewItems);
  }

  private async verifyAcceptanceDocumentIndexEditable(
    application: Application | null,
    acceptanceDocIndex: number
  ): Promise<void> {
    await this.verifyAcceptanceDocumentsEditable(application);
    if (this.resolveOfferAcceptancePhase(application) !== "CHANGES_REQUESTED") {
      return;
    }
    assertAcceptanceDocumentIndexEditableInChangesRequested(
      acceptanceDocIndex,
      this.getFlaggedAcceptanceDocumentIndices(application)
    );
  }

  private async verifyAcceptanceDocumentsEditable(application: Application | null): Promise<void> {
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
    throw new AppError(
      403,
      "EDIT_NOT_ALLOWED",
      "Application cannot be edited in its current status"
    );
  }

  private async getProductWorkflowForApplication(
    application: Application | null
  ): Promise<unknown[]> {
    const productId = (application?.financing_type as { product_id?: string } | null | undefined)
      ?.product_id;
    if (!productId || typeof productId !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "Application has no product for document upload");
    }
    const productVersion = (application as { product_version?: number | null } | null)
      ?.product_version;
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
      throw new AppError(
        404,
        "ORGANIZATION_NOT_FOUND",
        "Organization not found for this application"
      );
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
  async createApplication(
    input: CreateApplicationInput,
    userId: string,
    logContext?: IssuerActivityLogContext
  ): Promise<Application> {
    const startMs = Date.now();
    const correlationId = logContext?.context?.correlationId ?? null;
    logApplicationFlowEvent({
      level: "info",
      event: "APPLICATION_CREATED_STARTED",
      result: "STARTED",
      correlationId,
      applicationId: null,
      applicationReference: null,
      productId: input.productId,
      productCode: null,
      productVersion: null,
      issuerOrganizationId: input.issuerOrganizationId,
      userId,
      action: "CREATE",
      applicationStatus: null,
      previousStatus: null,
      downstreamIntegration: null,
      validationRule: null,
      endpoint: null,
      method: null,
      durationMs: null,
    });

    await legalDocumentAcceptanceService.assertNoPendingReacceptance(
      userId,
      input.issuerOrganizationId,
      "ISSUER",
      "NEW_FINANCING_APPLICATION"
    );

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

    const productCode = await resolveApplicationProductCode(prisma, {
      id: "new-application",
      financing_type: { product_id: input.productId, product_code: product.product_code ?? null },
      product_version: product.version,
    });
    if (!productCode) {
      throw new AppError(
        422,
        "PRODUCT_CODE_REQUIRED",
        "Selected product is missing a canonical product code. Configure product code before creating an application."
      );
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.application.create({
          data: {
            issuer_organization_id: input.issuerOrganizationId,
            product_version: product.version,
            financing_type: withSplitOriginationMarker({
              product_id: input.productId,
              product_code: productCode,
            }) as Prisma.InputJsonValue,
            status: "DRAFT",
            last_completed_step: 1,
          },
        });

        await allocateDisplayReference(
          {
            moduleCode: "APP",
            productCode,
            referenceDate: row.created_at,
            entityType: "application",
            entityId: row.id,
            tx,
          },
          async (persistTx, reference) => {
            await persistTx.application.update({
              where: { id: row.id },
              data: { display_reference: reference },
            });
          }
        );

        await logApplicationActivity(
          {
            userId,
            applicationId: row.id,
            eventType: ApplicationLogEventType.APPLICATION_CREATED,
            reviewCycle: 1,
            portal: ActivityPortal.ISSUER,
            ipAddress: logContext?.ipAddress,
            userAgent: logContext?.userAgent,
            context: logContext?.context,
          },
          tx
        );

        return tx.application.findUniqueOrThrow({
          where: { id: row.id },
        });
      });

      logApplicationFlowEvent({
        level: "info",
        event: "APPLICATION_CREATED_SUCCESS",
        result: "SUCCESS",
        correlationId,
        applicationId: created.id,
        applicationReference: (created as unknown as { display_reference?: string | null })
          .display_reference ?? null,
        productId: input.productId,
        productCode: productCode,
        productVersion: product.version,
        issuerOrganizationId: input.issuerOrganizationId,
        userId,
        action: "CREATE",
        applicationStatus: created.status as string | null,
        previousStatus: null,
        downstreamIntegration: null,
        validationRule: null,
        endpoint: null,
        method: null,
        durationMs: Date.now() - startMs,
      });

      return created;
    } catch (err) {
      const errorStack = err instanceof Error ? err.stack ?? null : null;
      logApplicationFlowEvent({
        level: "error",
        event: "APPLICATION_CREATED_FAILED",
        result: "FAILED",
        correlationId,
        applicationId: null,
        applicationReference: null,
        productId: input.productId,
        productCode,
        productVersion: product.version,
        issuerOrganizationId: input.issuerOrganizationId,
        userId,
        action: "CREATE",
        applicationStatus: null,
        previousStatus: null,
        downstreamIntegration: null,
        validationRule: null,
        endpoint: null,
        method: null,
        durationMs: Date.now() - startMs,
        errorCode: err instanceof AppError ? err.code : "UNEXPECTED_ERROR",
        errorType: err instanceof Error ? err.name : "UnknownError",
        safeErrorMessage: safeServerErrorMessage(err),
        errorStack,
      });
      throw err;
    }
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

    // ARCHIVED apps remain readable on the detail page; edit/mutations enforce status separately.
    const envelopes = await prisma.signingEnvelope.findMany({
      where: { application_id: id },
      select: SIGNING_ENVELOPE_OFFER_SUMMARY_SELECT,
    });
    return overlayReadCapacityOnApplicationContract(
      prisma,
      await attachInheritedFacilitySupportingDocuments(
        prisma,
        await attachInheritedFacilityGuarantors(
          prisma,
          enrichApplicationOriginationFields(
            application as Parameters<typeof enrichApplicationOriginationFields>[0] & {
              display_reference?: string | null;
            },
            toSigningEnvelopeOfferSummaries(envelopes)
          )
        )
      )
    );
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
    const appIds = applications.map((application) => application.id);
    const envelopes =
      appIds.length === 0
        ? []
        : await prisma.signingEnvelope.findMany({
            where: { application_id: { in: appIds } },
            select: SIGNING_ENVELOPE_OFFER_SUMMARY_SELECT,
          });
    const envelopesByApplication = groupSigningEnvelopeOfferSummariesByApplication(envelopes);

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

    return overlayReadCapacityOnApplications(
      prisma,
      applications.map((application) => {
        const enriched = enrichApplicationOriginationFields(
          application as Parameters<typeof enrichApplicationOriginationFields>[0],
          envelopesByApplication.get(application.id) ?? []
        );
        return {
          ...enriched,
          directorShareholderAmlPending: isFinalApplicationStatus(application.status)
            ? false
            : directorShareholderAmlPending,
        };
      })
    );
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
      application: await overlayReadCapacityOnApplicationContract(prisma, application),
      review_cycle: (application as any).review_cycle ?? 1,
      remarks,
    };
  }

  async getApplicationLogs(id: string, userId: string, options?: { asAdmin?: boolean }) {
    if (options?.asAdmin) {
      const application = await this.repository.findById(id);
      if (!application) {
        throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
      }
    } else {
      await this.verifyApplicationAccess(id, userId);
    }

    const logs = await prisma.applicationLog.findMany({
      where: { application_id: id },
      orderBy: { created_at: "desc" },
    });

    const actorIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[];
    const actorNameMap = await loadUserDisplayNameMap(prisma, actorIds);

    return logs.map((log) => {
      const meta = (log.metadata as Record<string, unknown>) ?? {};
      const actorName = log.user_id ? (actorNameMap.get(log.user_id) ?? null) : null;
      const mergedMeta = actorName ? { ...meta, actorName } : meta;
      let activity: string | undefined;
      const resubmitChanges = mergedMeta.resubmit_changes as
        | { activity_summary?: string }
        | undefined;
      if (log.event_type === "APPLICATION_RESUBMITTED") {
        // Rich amendment resubmits carry a diff-derived summary; the bare status-PATCH path
        // (no amendment metadata) still needs an accurate, non-empty description.
        activity = resubmitChanges?.activity_summary || "Application resubmitted for review";
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
      throw new AppError(
        400,
        "INVALID_STATE",
        "Acknowledgement allowed only in AMENDMENT_REQUESTED state"
      );
    }
    return amendmentAcknowledgeWorkflow(applicationId, workflowId, this.repository);
  }

  /**
   * Resubmit an application after amendments are acknowledged.
   * 1. Delete only REQUEST_AMENDMENT review records
   * 2. Create application revision snapshot
   * 3. Set status to RESUBMITTED
   */
  async resubmitApplication(
    applicationId: string,
    userId: string,
    logContext?: IssuerActivityLogContext
  ) {
    const startMs = Date.now();
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const correlationId = logContext?.context?.correlationId ?? null;
    const financingType = application.financing_type as unknown as
      | { product_id?: string; product_code?: string }
      | null;
    const productId = financingType?.product_id ?? null;
    const productCode = financingType?.product_code ?? null;
    const productVersion =
      (application as unknown as { product_version?: number | null }).product_version ?? null;
    const applicationReference = (application as unknown as { display_reference?: string | null })
      .display_reference ?? null;

    logApplicationFlowEvent({
      level: "info",
      event: "APPLICATION_STATUS_ACTION_STARTED",
      result: "STARTED",
      correlationId,
      applicationId: applicationId,
      applicationReference,
      productId,
      productCode,
      productVersion,
      issuerOrganizationId: application.issuer_organization_id,
      userId,
      action: "RESUBMITTED",
      applicationStatus: "RESUBMITTED",
      previousStatus: "AMENDMENT_REQUESTED",
      downstreamIntegration: null,
      validationRule: null,
      endpoint: null,
      method: null,
      durationMs: null,
    });
    let result: any;
    try {
      if ((application as any).status !== "AMENDMENT_REQUESTED") {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Resubmit allowed only in AMENDMENT_REQUESTED state"
        );
      }
      await assertIssuerOrgDirectorShareholderOnboardingReady(application.issuer_organization_id);
      await assertIssuerProfileCompleteForSubmit(application.issuer_organization_id);
      result = await amendmentResubmitApplication(
        applicationId,
        userId,
        this.repository,
        logContext
      );
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const isAppError = err instanceof AppError;
      const isUserFailure = isAppError && err.statusCode >= 400 && err.statusCode < 500;
      if (isUserFailure) {
        logApplicationFlowEvent({
          level: "warn",
          event: "APPLICATION_STATUS_VALIDATION_FAILED",
          result: "VALIDATION_FAILED",
          correlationId,
          applicationId,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          action: "RESUBMITTED",
          applicationStatus: "RESUBMITTED",
          previousStatus: "AMENDMENT_REQUESTED",
          durationMs,
          endpoint: null,
          method: null,
          downstreamIntegration: null,
          validationRule: null,
          errorCode: err.code,
          errorType: err.name,
          safeErrorMessage: err.message,
        });
      } else {
        const errorStack = err instanceof Error ? err.stack ?? null : null;
        logApplicationFlowEvent({
          level: "error",
          event: "APPLICATION_STATUS_ACTION_FAILED",
          result: "FAILED",
          correlationId,
          applicationId,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          action: "RESUBMITTED",
          applicationStatus: "RESUBMITTED",
          previousStatus: "AMENDMENT_REQUESTED",
          durationMs,
          endpoint: null,
          method: null,
          downstreamIntegration: null,
          validationRule: null,
          errorCode: isAppError ? (err as AppError).code : "UNEXPECTED_ERROR",
          errorType: err instanceof Error ? err.name : "UnknownError",
          safeErrorMessage: safeServerErrorMessage(err),
          errorStack,
        });
      }
      throw err;
    }

    try {
      await this.sendIssuerNotification(
        applicationId,
        NotificationTypeIds.APPLICATION_RESUBMITTED_CONFIRMATION,
        {
          applicationId,
          reviewCycle:
            (result as { review_cycle?: number })?.review_cycle ??
            ((application as { review_cycle?: number }).review_cycle ?? 1) + 1,
        },
        `resubmitted:${(result as { review_cycle?: number })?.review_cycle ?? "next"}`
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, applicationId },
        "Failed to send application resubmitted confirmation notification"
      );
    }

    logApplicationFlowEvent({
      level: "info",
      event: "APPLICATION_STATUS_ACTION_SUCCESS",
      result: "SUCCESS",
      correlationId,
      applicationId,
      applicationReference,
      productId,
      productCode,
      productVersion,
      issuerOrganizationId: application.issuer_organization_id,
      userId,
      action: "RESUBMITTED",
      applicationStatus: "RESUBMITTED",
      previousStatus: "AMENDMENT_REQUESTED",
      durationMs: Date.now() - startMs,
      endpoint: null,
      method: null,
      downstreamIntegration: null,
      validationRule: null,
    });

    return result;
  }

  /**
   * Update a specific step in the application
   */
  async updateStep(
    id: string,
    input: UpdateApplicationStepInput,
    userId: string,
    options?: {
      logContext?: IssuerActivityLogContext;
      request?: { method: string; endpoint: string };
    }
  ): Promise<Application> {
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const fieldName = this.getFieldNameForStepId(input.stepId);
    const startMs = Date.now();
    let validationRule: string | null = null;
    const stepKey = getStepKeyFromStepId(input.stepId);
    const action = input.forceRewindToStep !== undefined ? "REWIND" : "SAVE_AND_CONTINUE";
    const applicationStatus = (application as unknown as { status?: string | null }).status ?? null;
    const previousStatus = applicationStatus;
    const financingType = application.financing_type as unknown as
      | { product_id?: string; product_code?: string }
      | null;
    const productId = financingType?.product_id ?? null;
    const productCode = financingType?.product_code ?? null;
    const productVersion =
      (application as unknown as { product_version?: number | null }).product_version ?? null;
    const applicationReference = (application as unknown as { display_reference?: string | null })
      .display_reference ?? null;
    const nextStepNumberCandidate =
      typeof input.forceRewindToStep === "number" ? input.forceRewindToStep + 1 : input.stepNumber + 1;
    validationRule = fieldName ? `${stepKey ?? "unknown"}_STEP_SAVE` : "STEP_PROGRESS_UPDATE";

    logApplicationStepAction({
      level: "info",
      event: "APPLICATION_STEP_ACTION_STARTED",
      result: "STARTED",
      logContext: options?.logContext,
      applicationId: id,
      applicationReference,
      productId,
      productCode,
      productVersion,
      issuerOrganizationId: application.issuer_organization_id,
      userId,
      configuredStepId: input.stepId,
      stepKey,
      stepName: stepKey,
      action,
      validationRule,
      applicationStatus,
      previousStatus,
      nextStepNumber: nextStepNumberCandidate,
      endpoint: options?.request?.endpoint ?? null,
      method: options?.request?.method ?? null,
    });

    try {
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
            updateData.last_completed_step = Math.max(
              application.last_completed_step,
              input.stepNumber
            );
          }
        }

        const updated = await this.repository.update(id, updateData);
        logApplicationStepAction({
          level: "info",
          event: "APPLICATION_STEP_ACTION_SUCCESS",
          result: "SUCCESS",
          logContext: options?.logContext,
          applicationId: id,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          configuredStepId: input.stepId,
          stepKey,
          stepName: stepKey,
          action,
          applicationStatus,
          previousStatus,
          nextStepNumber: nextStepNumberCandidate,
          durationMs: Date.now() - startMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
        });
        return updated;
      }

      /** Enforce amendment boundaries: only flagged sections/items can be updated. */
      let amendmentAllowedItemKeys: Set<string> | null = null;
      if ((application as any).status === "AMENDMENT_REQUESTED") {
        const { allowedSections, allowedItemKeys } = await getAmendmentAllowedSections(id);
        amendmentAllowedItemKeys = allowedItemKeys;
        if (!allowedSections.has(fieldName)) {
          throw new AppError(
            403,
            "AMENDMENT_LOCKED",
            "This section is locked during amendment review"
          );
        }
      }

      if (fieldName === "company_details") {
        validationRule = "COMPANY_DETAILS_VALIDATION";
        this.validateCompanyDetailsData(input.data as Record<string, unknown>);
      }

      let dataToStore: Prisma.InputJsonValue = input.data as Prisma.InputJsonValue;

      if (fieldName === "business_details") {
        validationRule = "BUSINESS_DETAILS_SCHEMA";
        const inheritGuarantors = isInheritedFacilityGuarantorReview(
          readFinancingStructureType(application.financing_structure)
        );
        const payload = inheritGuarantors
          ? { ...(input.data as Record<string, unknown>), guarantors: [] }
          : input.data;
        const result = inheritGuarantors
          ? businessDetailsInheritedGuarantorsDataSchema.safeParse(payload)
          : businessDetailsDataSchema.safeParse(payload);
        if (!result.success) {
          const message = result.error.errors.map((e) => e.message).join("; ");
          throw new AppError(400, "VALIDATION_ERROR", message);
        }
        const { guarantors: _guarantors, ...businessDetailsWithoutGuarantors } = result.data;
        dataToStore = preserveLegacyAboutYourBusinessFields(
          businessDetailsWithoutGuarantors as Record<string, unknown>,
          input.data,
          application.business_details
        ) as Prisma.InputJsonValue;
      }

      if (fieldName === "financial_statements") {
        validationRule = "FINANCIAL_STATEMENTS_FYE_RULES";
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

        const serverNow = new Date();
        const parsed = parseFinancialStatementsForStepSave({
          applicationStatus: application.status,
          storedFinancialStatements: application.financial_statements,
          payload,
          now: serverNow,
        });
        if (!parsed.ok) {
          throw new AppError(400, "VALIDATION_ERROR", parsed.message);
        }
        const { questionnaire, unaudited_by_year } = parsed.data;
        const expectedYears = parsed.expectedYears;
        const dbg = getFinancialYearEndComputationDetails(questionnaire, serverNow);
        logger.debug(
          {
            fye: dbg.fye,
            previousFYEndIso: dbg.previousFYEndIso,
            deadlineIso: dbg.deadlineIso,
            todayIso: dbg.todayIso,
            years: dbg.years,
            expectedYears,
            fyeValidation: getFinancialYearEndValidationError(
              questionnaire.financial_year_end,
              serverNow
            ),
          },
          "Financial statements FYE computation"
        );
        const actualKeys = Object.keys(unaudited_by_year).sort();
        const expectedStr = expectedYears.map((y) => String(y)).sort();
        if (
          actualKeys.length !== expectedStr.length ||
          actualKeys.some((k, i) => k !== expectedStr[i])
        ) {
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
          normalizedByYear[key] = normalizeFinancialYearBlock(
            block as Record<string, unknown>
          );
        }

        // Preserve any Admin-only historical fallback blocks stored on the application.
        // Issuer saves overwrite only `questionnaire` + `unaudited_by_year`.
        // A changed issuer value clears that field's User Input override. CTOS gap fills stay.
        const existingFs =
          application.financial_statements && typeof application.financial_statements === "object"
            ? (application.financial_statements as Record<string, unknown>)
            : {};
        const previousUnaudited =
          existingFs.unaudited_by_year &&
          typeof existingFs.unaudited_by_year === "object" &&
          !Array.isArray(existingFs.unaudited_by_year)
            ? (existingFs.unaudited_by_year as Record<string, unknown>)
            : null;
        dataToStore = {
          ...existingFs,
          questionnaire,
          unaudited_by_year: normalizedByYear,
          admin_field_overrides: reconcileAdminFieldOverridesAfterIssuerSave({
            existingFinancialStatements: existingFs,
            previousUnauditedByYear: previousUnaudited,
            nextUnauditedByYear: normalizedByYear as Record<string, Record<string, unknown>>,
          }),
        } as Prisma.InputJsonValue;
      }

      /** financing_type stores only product_id; product_version lives in application.product_version column. */
      if (fieldName === "financing_type") {
        validationRule = "FINANCING_TYPE_UPDATE";
        const financingData = input.data as Record<string, unknown>;
        const productId = financingData?.product_id as string | undefined;
        dataToStore = productId
          ? (preserveSplitOriginationMarker(
              { product_id: productId },
              application.financing_type
            ) as Prisma.InputJsonValue)
          : dataToStore;
      }

      if (fieldName === "supporting_documents") {
        validationRule = "SUPPORTING_DOCUMENTS_EDIT_RULES";
        const structureType = readFinancingStructureType(application.financing_structure);
        if (structureType === "existing_contract") {
          const workflow = await this.getProductWorkflowForApplication(application);
          const locked = getFacilityLockedCategoriesFromWorkflow(workflow);
          if (locked.length > 0) {
            const origin = application.contract_id
              ? await loadInheritedSupportingDocumentsForExistingContract(prisma, {
                  contractId: application.contract_id,
                  originatingApplicationId:
                    (application as { contract?: { originating_application_id?: string | null } })
                      .contract?.originating_application_id ?? null,
                })
              : null;
            if (
              facilityLockedSupportingDocumentsChanged(
                input.data,
                origin?.supporting_documents,
                locked
              )
            ) {
              throw new AppError(
                403,
                "EDIT_NOT_ALLOWED",
                FACILITY_LOCKED_SUPPORTING_DOCUMENTS_MESSAGE
              );
            }
            dataToStore = stripFacilityLockedSupportingDocuments(
              input.data,
              locked
            ) as Prisma.InputJsonValue;
          }
        }
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

      // Special handling for financing_structure: branch reset + link/unlink contract
      if (fieldName === "financing_structure") {
        validationRule = "FINANCING_STRUCTURE_UPDATE_RULES";
        const structureData = input.data as {
          structure_type?: string;
          existing_contract_id?: string | null;
        };
        const prevStructure = application.financing_structure as {
          structure_type?: string;
          existing_contract_id?: string | null;
        } | null;
        const nextType = structureData?.structure_type;
        const prevType = prevStructure?.structure_type;
        const structureBranchChanged =
          Boolean(nextType) &&
          (prevType !== nextType ||
            (nextType === "existing_contract" &&
              (prevStructure?.existing_contract_id ?? null) !==
                (structureData?.existing_contract_id ?? null)));

        if (structureBranchChanged) {
          await this.resetFinancingStructureBranchData(application);
        }

        if (
          structureData?.structure_type === "existing_contract" &&
          structureData?.existing_contract_id
        ) {
          const contract = await this.contractRepository.findById(
            structureData.existing_contract_id
          );

          if (!contract) {
            throw new AppError(
              404,
              "CONTRACT_NOT_FOUND",
              "The selected facility does not exist."
            );
          }

          assertExistingFacilityDrawdown(
            {
              financing_type: application.financing_type,
              financing_structure: structureData,
              issuer_organization_id: application.issuer_organization_id,
              contract_id: structureData.existing_contract_id,
            },
            contract
          );

          updateData.contract = { connect: { id: structureData.existing_contract_id } };
          await prisma.applicationGuarantor.deleteMany({ where: { application_id: id } });
        } else if (
          structureData?.structure_type === "invoice_only" ||
          structureData?.structure_type === "new_contract"
        ) {
          // Branch reset already removed a draft holder contract; disconnect covers approved links.
          if (application.contract_id) {
            updateData.contract = { disconnect: true };
          }
        }
      }

      // Update last_completed_step if this is a new step
      // Do not update last_completed_step when in amendment mode
      if ((application as any).status !== "AMENDMENT_REQUESTED") {
        if (input.forceRewindToStep !== undefined) {
          updateData.last_completed_step = input.forceRewindToStep;
        } else {
          updateData.last_completed_step = Math.max(
            application.last_completed_step,
            input.stepNumber
          );
        }
      }

      if (fieldName === "acceptance_documents") {
        validationRule = "ACCEPTANCE_DOCUMENTS_EDIT_RULES";
        if (this.resolveOfferAcceptancePhase(application) === "CHANGES_REQUESTED") {
          const changedIndices = findChangedAcceptanceDocumentIndices(
            (application as { acceptance_documents?: unknown }).acceptance_documents,
            input.data
          );
          const flagged = this.getFlaggedAcceptanceDocumentIndices(application);
          for (const idx of changedIndices) {
            assertAcceptanceDocumentIndexEditableInChangesRequested(idx, flagged);
          }
        }
        const updated = await this.repository.update(id, updateData);
        logApplicationStepAction({
          level: "info",
          event: "APPLICATION_STEP_ACTION_SUCCESS",
          result: "SUCCESS",
          logContext: options?.logContext,
          applicationId: id,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          configuredStepId: input.stepId,
          stepKey,
          stepName: stepKey,
          action,
          applicationStatus,
          previousStatus,
          nextStepNumber: nextStepNumberCandidate,
          durationMs: Date.now() - startMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
        });
        return updated;
      }

      if (fieldName === "supporting_documents") {
        if (
          (application as { status?: string }).status === "AMENDMENT_REQUESTED" &&
          amendmentAllowedItemKeys
        ) {
          const changedSlots = findChangedSupportingDocumentSlots(
            application.supporting_documents,
            input.data
          );
          for (const slot of changedSlots) {
            assertSupportingDocumentSlotEditable(
              slot.categoryKey,
              slot.documentIndex,
              amendmentAllowedItemKeys
            );
          }
        }
        const existingKeys = this.extractS3KeysFromSupportingDocuments(
          application.supporting_documents
        );
        const incomingKeys = this.extractS3KeysFromSupportingDocuments(input.data);
        const newKeys = [...incomingKeys].filter((k) => !existingKeys.has(k));

        try {
          const updated = await this.repository.update(id, updateData);
          logApplicationStepAction({
            level: "info",
            event: "APPLICATION_STEP_ACTION_SUCCESS",
            result: "SUCCESS",
            logContext: options?.logContext,
            applicationId: id,
            applicationReference,
            productId,
            productCode,
            productVersion,
            issuerOrganizationId: application.issuer_organization_id,
            userId,
            configuredStepId: input.stepId,
            stepKey,
            stepName: stepKey,
            action,
            applicationStatus,
            previousStatus,
            nextStepNumber: nextStepNumberCandidate,
            durationMs: Date.now() - startMs,
            endpoint: options?.request?.endpoint ?? null,
            method: options?.request?.method ?? null,
          });
          return updated;
        } catch (err) {
          await this.deleteOrphanS3Keys(newKeys);
          throw err;
        }
      }

      if (fieldName === "business_details") {
        const inheritGuarantors = isInheritedFacilityGuarantorReview(
          readFinancingStructureType(application.financing_structure)
        );
        const updated = await prisma.$transaction(async (tx) => {
          const row = await tx.application.update({
            where: { id },
            data: updateData,
          });
          if (inheritGuarantors) {
            await tx.applicationGuarantor.deleteMany({ where: { application_id: id } });
          } else {
            await this.syncApplicationGuarantors(tx, id, input.data);
          }
          return row as Application;
        });
        logApplicationStepAction({
          level: "info",
          event: "APPLICATION_STEP_ACTION_SUCCESS",
          result: "SUCCESS",
          logContext: options?.logContext,
          applicationId: id,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          configuredStepId: input.stepId,
          stepKey,
          stepName: stepKey,
          action,
          applicationStatus,
          previousStatus,
          nextStepNumber: nextStepNumberCandidate,
          durationMs: Date.now() - startMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
        });
        return updated;
      }

      const updated = await this.repository.update(id, updateData);
      logApplicationStepAction({
        level: "info",
        event: "APPLICATION_STEP_ACTION_SUCCESS",
        result: "SUCCESS",
        logContext: options?.logContext,
        applicationId: id,
        applicationReference,
        productId,
        productCode,
        productVersion,
        issuerOrganizationId: application.issuer_organization_id,
        userId,
        configuredStepId: input.stepId,
        stepKey,
        stepName: stepKey,
        action,
        applicationStatus,
        previousStatus,
        nextStepNumber: nextStepNumberCandidate,
        durationMs: Date.now() - startMs,
        endpoint: options?.request?.endpoint ?? null,
        method: options?.request?.method ?? null,
      });
      return updated;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const isAppError = err instanceof AppError;
      const isUserFailure =
        isAppError && err.statusCode >= 400 && err.statusCode < 500;

      if (isUserFailure) {
        logApplicationStepAction({
          level: "warn",
          event: "APPLICATION_STEP_VALIDATION_FAILED",
          result: "VALIDATION_FAILED",
          logContext: options?.logContext,
          applicationId: id,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          configuredStepId: input.stepId,
          stepKey,
          stepName: stepKey,
          action,
          validationRule,
          applicationStatus,
          previousStatus,
          nextStepNumber: nextStepNumberCandidate,
          durationMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
          errorCode: err.code,
          errorType: err.name,
          safeErrorMessage: err.message,
        });
      } else {
        const errorStack = err instanceof Error ? err.stack ?? null : null;
        logApplicationStepAction({
          level: "error",
          event: isAppError ? "APPLICATION_STEP_ACTION_FAILED" : "APPLICATION_STEP_ACTION_FAILED",
          result: "FAILED",
          logContext: options?.logContext,
          applicationId: id,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          configuredStepId: input.stepId,
          stepKey,
          stepName: stepKey,
          action,
          validationRule,
          applicationStatus,
          previousStatus,
          nextStepNumber: nextStepNumberCandidate,
          durationMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
          errorCode: isAppError ? err.code : "UNEXPECTED_ERROR",
          errorType: err instanceof Error ? err.name : "UnknownError",
          safeErrorMessage: safeServerErrorMessage(err),
          errorStack,
        });
      }
      throw err;
    }
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

    const archivedAt = (application as { archived_at?: Date | null }).archived_at;
    if (archivedAt || application.status === "ARCHIVED") {
      throw new AppError(400, "INVALID_STATE", "This application is already archived.");
    }

    const envelopes = await prisma.signingEnvelope.findMany({
      where: { application_id: id },
      select: { status: true },
    });
    const phase = resolveApplicationOriginationPhase({
      status: application.status,
      contract: (
        application as { contract?: { status?: string | null; offer_details?: unknown } | null }
      ).contract,
      invoices: (
        application as { invoices?: Array<{ status?: string | null; offer_details?: unknown }> }
      ).invoices,
      financing_structure: (application as { financing_structure?: unknown }).financing_structure,
      signing_envelopes: envelopes,
    });
    if (!canArchiveApplication(phase, { alreadyArchived: !!archivedAt })) {
      throw new AppError(
        400,
        "INVALID_STATE",
        "Only draft or closed applications can be archived. Withdraw or wait until the file is closed first."
      );
    }

    if (phase === "draft") {
      return this.repository.update(id, {
        status: "ARCHIVED",
        updated_at: new Date(),
      });
    }

    return this.repository.update(id, {
      archived_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * Cancel an application (issuer-only). Withdraws active invoices and contract only.
   */
  async cancelApplication(
    id: string,
    userId: string,
    logContext?: IssuerActivityLogContext
  ): Promise<Application> {
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const status = application.status as ApplicationStatus;
    const contract =
      (
        application as {
          contract?: { id: string; status?: string; offer_details?: unknown } | null;
        }
      ).contract ?? null;
    const invoices =
      (application as { invoices?: Array<{ id: string; status: string; offer_details?: unknown }> })
        .invoices ?? [];
    const envelopes = await prisma.signingEnvelope.findMany({
      where: { application_id: id },
      select: { id: true, status: true },
    });
    const phase = resolveApplicationOriginationPhase({
      status,
      contract,
      invoices,
      financing_structure: (application as { financing_structure?: unknown }).financing_structure,
      signing_envelopes: envelopes,
    });

    if (!canWithdrawApplication(phase)) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        phase === "closed"
          ? "This application can no longer be cancelled."
          : "This application can no longer be withdrawn after a facility or invoice has been approved."
      );
    }

    const voidableIds = envelopes
      .filter((envelope) => ["DRAFT", "SENT", "IN_PROGRESS"].includes(envelope.status))
      .map((envelope) => envelope.id);

    const withdrawInTx = async (tx: Prisma.TransactionClient) => {
      const locked = await tx.application.findUnique({
        where: { id },
        include: {
          contract: {
            select: { id: true, status: true, offer_details: true },
          },
          invoices: {
            select: { id: true, status: true, offer_details: true },
          },
        },
      });
      if (!locked) {
        throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
      }

      const lockedEnvelopes = await tx.signingEnvelope.findMany({
        where: { application_id: id },
        select: { status: true },
      });
      const lockedPhase = resolveApplicationOriginationPhase({
        status: locked.status,
        contract: locked.contract,
        invoices: locked.invoices,
        financing_structure: locked.financing_structure,
        signing_envelopes: lockedEnvelopes,
      });
      if (!canWithdrawApplication(lockedPhase)) {
        throw new AppError(
          400,
          "BAD_REQUEST",
          lockedPhase === "closed"
            ? "This application can no longer be cancelled."
            : "This application can no longer be withdrawn after a facility or invoice has been approved."
        );
      }

      for (const invoice of locked.invoices ?? []) {
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

      const lockedContract = locked.contract;
      if (
        lockedContract &&
        lockedContract.status !== ContractStatus.APPROVED &&
        lockedContract.status !== ContractStatus.WITHDRAWN &&
        lockedContract.status !== ContractStatus.REJECTED
      ) {
        await tx.contract.update({
          where: { id: lockedContract.id },
          data: {
            status: ContractStatus.WITHDRAWN,
            withdraw_reason: WithdrawReason.USER_CANCELLED,
          },
        });
      }

      const updatedInvoices = await tx.invoice.findMany({
        where: { application_id: id },
      });

      const contractId = lockedContract?.id ?? locked.contract_id;
      const updatedContract = contractId
        ? await tx.contract.findUnique({ where: { id: contractId } })
        : null;

      const isInvoiceOnly =
        (locked.financing_structure as { structure_type?: string } | null)?.structure_type ===
        "invoice_only";
      const newStatus = computeApplicationStatus(
        updatedContract as { status: ContractStatus } | null,
        updatedInvoices.map((i) => ({ status: i.status as InvoiceStatus })),
        locked.status as ApplicationStatus,
        { isInvoiceOnly }
      );

      const statusWrite = await tx.application.updateMany({
        where: {
          id,
          status: locked.status,
        },
        data: { status: newStatus as unknown as DbApplicationStatus },
      });
      if (statusWrite.count === 0) {
        throw new AppError(409, "CONFLICT", "Application status changed during withdrawal.");
      }
    };

    const capacityContractId = isInvoiceOnlyFinancingStructure(application.financing_structure)
      ? null
      : (contract?.id ?? (application as { contract_id?: string | null }).contract_id);
    if (capacityContractId) {
      await applyContractCapacityChange(capacityContractId, prisma, withdrawInTx, {
        assertWrite: true,
      });
    } else {
      await prisma.$transaction(withdrawInTx);
    }

    if (voidableIds.length > 0) {
      const { signingService } = await import("../signing/service");
      for (const envelopeId of voidableIds) {
        try {
          await signingService.voidEnvelope(envelopeId, "Application withdrawn by issuer", {
            userId,
            portal: ActivityPortal.ISSUER,
          });
        } catch (voidError) {
          logger.error(
            { error: voidError, applicationId: id, envelopeId },
            "Failed to void signing envelope during application withdrawal"
          );
        }
      }
    }

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
        ...logContext,
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
  async requestUploadUrl(
    params: {
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
  },
    options?: {
      logContext?: IssuerActivityLogContext;
      request?: { method: string; endpoint: string };
    }
  ): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
    await this.verifyApplicationAccess(params.applicationId, params.userId);
    const application = await this.repository.findById(params.applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    const startMs = Date.now();
    const correlationId = options?.logContext?.context?.correlationId ?? null;
    const applicationStatus = (application as { status?: string } | null)?.status ?? null;
    const financingType = (application?.financing_type as unknown as
      | { product_id?: string; product_code?: string }
      | null) ?? null;
    const productId = financingType?.product_id ?? null;
    const productCode = financingType?.product_code ?? null;
    const productVersion =
      (application as unknown as { product_version?: number | null }).product_version ?? null;
    const applicationReference = (application as unknown as { display_reference?: string | null })
      .display_reference ?? null;
    const stepKey =
      params.acceptanceDocIndex !== undefined
        ? "acceptance_documents"
        : params.supportingDocCategoryKey !== undefined && params.supportingDocIndex !== undefined
          ? "supporting_documents"
          : params.guarantorAgreementUpload === true
            ? "business_details"
            : null;
    const validationRule = "UPLOAD_URL_RESOLUTION";
    const action = "UPLOAD_URL";

    logApplicationStepAction({
      level: "info",
      event: "APPLICATION_STEP_ACTION_STARTED",
      result: "STARTED",
      logContext: options?.logContext,
      correlationId,
      applicationId: params.applicationId,
      applicationReference,
      productId,
      productCode,
      productVersion,
      issuerOrganizationId: application?.issuer_organization_id ?? null,
      userId: params.userId,
      configuredStepId: null,
      stepKey,
      stepName: stepKey,
      action,
      validationRule,
      applicationStatus,
      previousStatus: applicationStatus,
      nextStepNumber: null,
      durationMs: null,
      endpoint: options?.request?.endpoint ?? null,
      method: options?.request?.method ?? null,
    });

    try {
    const isSupportingDocsWorkflowUpload =
      params.supportingDocCategoryKey !== undefined && params.supportingDocIndex !== undefined;
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
      await this.verifyAcceptanceDocumentIndexEditable(application, params.acceptanceDocIndex!);
    } else if (isSupportingDocsWorkflowUpload) {
      workflow = await this.getProductWorkflowForApplication(application);
      this.verifyApplicationEditable(application);
      assertSupportingDocCategoryNotFacilityLocked(
        workflow,
        readFinancingStructureType(application?.financing_structure),
        params.supportingDocCategoryKey!
      );
    } else if (isGuarantorAgreementUpload) {
      workflow = await this.getProductWorkflowForApplication(application);
      this.verifyApplicationEditable(application);
    } else {
      this.verifyApplicationEditable(application);
    }

    if ((application as any).status === "AMENDMENT_REQUESTED") {
      const { allowedSections, allowedItemKeys } = await getAmendmentAllowedSections(params.applicationId);
      if (isAcceptanceDocUpload) {
        // Acceptance docs are post-offer; amendment locks do not apply.
      } else if (isSupportingDocsWorkflowUpload) {
        if (!allowedSections.has("supporting_documents")) {
          throw new AppError(
            403,
            "AMENDMENT_LOCKED",
            "This section is locked during amendment review"
          );
        }
        assertSupportingDocumentSlotEditable(
          params.supportingDocCategoryKey!,
          params.supportingDocIndex!,
          allowedItemKeys
        );
      } else if (isGuarantorAgreementUpload) {
        if (!allowedSections.has("business_details")) {
          throw new AppError(
            403,
            "AMENDMENT_LOCKED",
            "This section is locked during amendment review"
          );
        }
      } else {
        /** Generic uploads must not be unlocked by supporting-document item remarks. */
        const canGenericUpload =
          allowedSections.has("business_details") ||
          (allowedSections.has("supporting_documents") &&
            !hasSupportingDocumentItemLocks(allowedItemKeys));
        if (!canGenericUpload) {
          throw new AppError(
            403,
            "AMENDMENT_LOCKED",
            "This section is locked during amendment review"
          );
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

    const uploadResult = await requestPresignedUploadUrl({
      applicationId: params.applicationId,
      fileName: params.fileName,
      contentType: params.contentType,
      fileSize: params.fileSize,
      existingS3Key: params.existingS3Key,
    });

    logApplicationStepAction({
      level: "info",
      event: "APPLICATION_STEP_ACTION_SUCCESS",
      result: "SUCCESS",
      logContext: options?.logContext,
      correlationId,
      applicationId: params.applicationId,
      applicationReference,
      productId,
      productCode,
      productVersion,
      issuerOrganizationId: application.issuer_organization_id,
      userId: params.userId,
      configuredStepId: null,
      stepKey,
      stepName: stepKey,
      action,
      validationRule,
      applicationStatus,
      previousStatus: applicationStatus,
      nextStepNumber: null,
      durationMs: Date.now() - startMs,
      endpoint: options?.request?.endpoint ?? null,
      method: options?.request?.method ?? null,
    });

    return uploadResult;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const isAppError = err instanceof AppError;
      const isUserFailure = isAppError && err.statusCode >= 400 && err.statusCode < 500;

      if (isUserFailure) {
        logApplicationStepAction({
          level: "warn",
          event: "APPLICATION_STEP_VALIDATION_FAILED",
          result: "VALIDATION_FAILED",
          logContext: options?.logContext,
          correlationId,
          applicationId: params.applicationId,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId: params.userId,
          configuredStepId: null,
          stepKey,
          stepName: stepKey,
          action,
          validationRule,
          applicationStatus,
          previousStatus: applicationStatus,
          nextStepNumber: null,
          durationMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
          errorCode: err.code,
          errorType: err.name,
          safeErrorMessage: err.message,
        });
      } else {
        const errorStack = err instanceof Error ? err.stack ?? null : null;
        logApplicationStepAction({
          level: "error",
          event: "APPLICATION_STEP_ACTION_FAILED",
          result: "FAILED",
          logContext: options?.logContext,
          correlationId,
          applicationId: params.applicationId,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId: params.userId,
          configuredStepId: null,
          stepKey,
          stepName: stepKey,
          action,
          validationRule,
          applicationStatus,
          previousStatus: applicationStatus,
          nextStepNumber: null,
          durationMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
          errorCode: isAppError ? err.code : "UNEXPECTED_ERROR",
          errorType: err instanceof Error ? err.name : "UnknownError",
          safeErrorMessage: safeServerErrorMessage(err),
          errorStack,
        });
      }
      throw err;
    }
  }

  /**
   * Delete an application document from S3.
   * Access and amendment checks performed here; S3 deletion delegated to documents service.
   * Post-offer supporting-doc removals are allowed while signing prep is unlocked (NAV-03/04).
   */
  async deleteDocument(
    applicationId: string,
    s3Key: string,
    userId: string,
    options?: {
      logContext?: IssuerActivityLogContext;
      request?: { method: string; endpoint: string };
    }
  ): Promise<void> {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const startMs = Date.now();
    const correlationId = options?.logContext?.context?.correlationId ?? null;
    const action = "DELETE_DOCUMENT";
    const validationRule = "DELETE_DOCUMENT_RULES";
    const applicationStatus = (application as { status?: string }).status ?? null;
    const financingType = application.financing_type as unknown as
      | { product_id?: string; product_code?: string }
      | null;
    const productId = financingType?.product_id ?? null;
    const productCode = financingType?.product_code ?? null;
    const productVersion = (application as unknown as { product_version?: number | null })
      .product_version ?? null;
    const applicationReference = (application as unknown as { display_reference?: string | null })
      .display_reference ?? null;

    logApplicationStepAction({
      level: "info",
      event: "APPLICATION_STEP_ACTION_STARTED",
      result: "STARTED",
      logContext: options?.logContext,
      correlationId,
      applicationId,
      applicationReference,
      productId,
      productCode,
      productVersion,
      issuerOrganizationId: application.issuer_organization_id,
      userId,
      configuredStepId: null,
      stepKey: null,
      stepName: null,
      action,
      validationRule,
      applicationStatus,
      previousStatus: applicationStatus,
      nextStepNumber: null,
      durationMs: null,
      endpoint: options?.request?.endpoint ?? null,
      method: options?.request?.method ?? null,
    });

    try {

    if (readFinancingStructureType(application.financing_structure) === "existing_contract") {
      const workflow = await this.getProductWorkflowForApplication(application);
      const locked = getFacilityLockedCategoriesFromWorkflow(workflow);
      if (locked.length > 0 && application.contract_id) {
        const origin = await loadInheritedSupportingDocumentsForExistingContract(prisma, {
          contractId: application.contract_id,
          originatingApplicationId:
            (application as { contract?: { originating_application_id?: string | null } }).contract
              ?.originating_application_id ?? null,
        });
        const originKeys = new Set(
          collectSupportingDocumentS3Keys(origin?.supporting_documents, locked)
        );
        if (originKeys.has(s3Key)) {
          throw new AppError(403, "EDIT_NOT_ALLOWED", FACILITY_LOCKED_SUPPORTING_DOCUMENTS_MESSAGE);
        }
      }
    }

    const status = (application as { status?: string }).status;
    if (status === ApplicationStatus.DRAFT || status === ApplicationStatus.AMENDMENT_REQUESTED) {
      if (status === ApplicationStatus.AMENDMENT_REQUESTED) {
        const { allowedSections, allowedItemKeys } = await getAmendmentAllowedSections(applicationId);
        const supportingSlot = findSupportingDocumentSlotForS3Key(
          application.supporting_documents,
          s3Key
        );
        if (supportingSlot) {
          if (!allowedSections.has("supporting_documents")) {
            throw new AppError(
              403,
              "AMENDMENT_LOCKED",
              "This section is locked during amendment review"
            );
          }
          assertSupportingDocumentSlotEditable(
            supportingSlot.categoryKey,
            supportingSlot.documentIndex,
            allowedItemKeys
          );
        } else if (!allowedSections.has("business_details")) {
          throw new AppError(
            403,
            "AMENDMENT_LOCKED",
            "This section is locked during amendment review"
          );
        }
      }
    } else if (this.hasOfferBeenSent(application)) {
      const supportingKeys = this.extractS3KeysFromSupportingDocuments(
        application.supporting_documents
      );
      const acceptanceKeys = this.extractS3KeysFromAcceptanceDocuments(
        (application as { acceptance_documents?: unknown }).acceptance_documents
      );
      const isAcceptanceKey = acceptanceKeys.has(s3Key);
      if (isAcceptanceKey) {
        await this.verifyAcceptanceDocumentsEditable(application);
        const idx = findAcceptanceDocumentIndexForS3Key(
          (application as { acceptance_documents?: unknown }).acceptance_documents,
          s3Key
        );
        if (idx !== null) {
          await this.verifyAcceptanceDocumentIndexEditable(application, idx);
        }
      }
      if (!supportingKeys.has(s3Key) && !isAcceptanceKey) {
        throw new AppError(
          403,
          "EDIT_NOT_ALLOWED",
          "Only uploaded acceptance or supporting documents can be removed after an offer is sent"
        );
      }
      await this.assertPostApplicationPrepUnlocked(applicationId);
    } else {
      throw new AppError(
        403,
        "EDIT_NOT_ALLOWED",
        "Application cannot be edited in its current status"
      );
    }

    if (shouldPreserveApplicationDocumentsInS3((application as { status?: string })?.status)) {
      logger.info(
        { applicationId, s3Key },
        "Skipped application document S3 delete: AMENDMENT_REQUESTED (preserve for compare/audit)"
      );
      logApplicationStepAction({
        level: "info",
        event: "APPLICATION_STEP_ACTION_SUCCESS",
        result: "SUCCESS",
        logContext: options?.logContext,
        correlationId,
        applicationId,
        applicationReference,
        productId,
        productCode,
        productVersion,
        issuerOrganizationId: application.issuer_organization_id,
        userId,
        configuredStepId: null,
        stepKey: null,
        stepName: null,
        action,
        validationRule,
        applicationStatus,
        previousStatus: applicationStatus,
        nextStepNumber: null,
        durationMs: Date.now() - startMs,
        endpoint: options?.request?.endpoint ?? null,
        method: options?.request?.method ?? null,
      });
      return;
    }

    await deleteDocumentFromS3(s3Key);

    logApplicationStepAction({
      level: "info",
      event: "APPLICATION_STEP_ACTION_SUCCESS",
      result: "SUCCESS",
      logContext: options?.logContext,
      correlationId,
      applicationId,
      applicationReference,
      productId,
      productCode,
      productVersion,
      issuerOrganizationId: application.issuer_organization_id,
      userId,
      configuredStepId: null,
      stepKey: null,
      stepName: null,
      action,
      validationRule,
      applicationStatus,
      previousStatus: applicationStatus,
      nextStepNumber: null,
      durationMs: Date.now() - startMs,
      endpoint: options?.request?.endpoint ?? null,
      method: options?.request?.method ?? null,
    });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const isAppError = err instanceof AppError;
      const isUserFailure = isAppError && err.statusCode >= 400 && err.statusCode < 500;
      if (isUserFailure) {
        logApplicationStepAction({
          level: "warn",
          event: "APPLICATION_STEP_VALIDATION_FAILED",
          result: "VALIDATION_FAILED",
          logContext: options?.logContext,
          correlationId,
          applicationId,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          configuredStepId: null,
          stepKey: null,
          stepName: null,
          action,
          validationRule,
          applicationStatus,
          previousStatus: applicationStatus,
          nextStepNumber: null,
          durationMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
          errorCode: err.code,
          errorType: err.name,
          safeErrorMessage: err.message,
        });
      } else {
        const errorStack = err instanceof Error ? err.stack ?? null : null;
        logApplicationStepAction({
          level: "error",
          event: "APPLICATION_STEP_ACTION_FAILED",
          result: "FAILED",
          logContext: options?.logContext,
          correlationId,
          applicationId,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          configuredStepId: null,
          stepKey: null,
          stepName: null,
          action,
          validationRule,
          applicationStatus,
          previousStatus: applicationStatus,
          nextStepNumber: null,
          durationMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
          errorCode: isAppError ? err.code : "UNEXPECTED_ERROR",
          errorType: err instanceof Error ? err.name : "UnknownError",
          safeErrorMessage: safeServerErrorMessage(err),
          errorStack,
        });
      }
      throw err;
    }
  }

  /**
   * Update application status and perform cleanup
   */
  async updateApplicationStatus(
    id: string,
    status: string,
    userId: string,
    logContext?: IssuerActivityLogContext,
    options?: { request?: { method: string; endpoint: string } }
  ): Promise<Application> {
    await this.verifyApplicationAccess(id, userId);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    this.verifyApplicationEditable(application);

    const startMs = Date.now();
    let validationRule: string | null = null;
    let downstreamIntegration: string | null = null;
    const previousStatus = application.status as string;
    const financingType = application.financing_type as unknown as
      | { product_id?: string; product_code?: string }
      | null;
    const productId = financingType?.product_id ?? null;
    const productCode = financingType?.product_code ?? null;
    const productVersion =
      (application as unknown as { product_version?: number | null }).product_version ?? null;
    const applicationReference = (application as unknown as { display_reference?: string | null })
      .display_reference ?? null;

    logApplicationFlowEvent({
      level: "info",
      event: "APPLICATION_STATUS_ACTION_STARTED",
      result: "STARTED",
      correlationId: logContext?.context?.correlationId ?? null,
      applicationId: id,
      applicationReference,
      productId,
      productCode,
      productVersion,
      issuerOrganizationId: application.issuer_organization_id,
      userId,
      configuredStepId: null,
      stepKey: null,
      stepName: null,
      action: status,
      validationRule,
      applicationStatus: status,
      previousStatus,
      downstreamIntegration,
      endpoint: options?.request?.endpoint ?? null,
      method: options?.request?.method ?? null,
      durationMs: null,
    });

    try {
    const currentStatus = application.status as string;
    if (status === "SUBMITTED" && currentStatus === "DRAFT") {
      validationRule = "NO_PENDING_REACCEPTANCE";
      await legalDocumentAcceptanceService.assertNoPendingReacceptance(
        userId,
        application.issuer_organization_id,
        "ISSUER",
        "NEW_FINANCING_APPLICATION"
      );
    }
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

    let pendingInitialSubmitRevision: {
      snapshot: Prisma.InputJsonValue;
      reviewCycle: number;
    } | null = null;
    let frozenSubmitWorkflow: unknown[] | undefined;

    // Snapshot initial-submit revision data before writes. Persist it in the same
    // transaction as capacity reservation / status changes so a rejected capacity
    // write cannot leave revision or org-prefill side effects.
    if (status === "SUBMITTED" && currentStatus === "DRAFT") {
      const submitContract =
        (
          application as {
            contract?: {
              id: string;
              status?: string | null;
              issuer_organization_id?: string | null;
            } | null;
          }
        ).contract ?? null;
      assertApplicationSubmitOrigination({
        application: {
          financing_type: application.financing_type,
          financing_structure: application.financing_structure,
          issuer_organization_id: application.issuer_organization_id,
          contract_id: application.contract_id,
        },
        invoices: (application as { invoices?: unknown[] }).invoices ?? [],
        contract: submitContract,
      });
      if (
        isInheritedFacilityGuarantorReview(
          readFinancingStructureType(application.financing_structure)
        )
      ) {
        const inheritedGuarantors = application.contract_id
          ? await loadInheritedGuarantorsForExistingContract(prisma, {
              contractId: application.contract_id,
              originatingApplicationId:
                (submitContract as { originating_application_id?: string | null } | null)
                  ?.originating_application_id ?? null,
            })
          : null;
        if (!inheritedGuarantors || inheritedGuarantors.application_guarantors.length === 0) {
          throw new AppError(400, "FACILITY_GUARANTORS_REQUIRED", FACILITY_GUARANTORS_REQUIRED);
        }
      }
      validationRule = "APPLICATION_PROCESSING_FEE_PAID";
      await assertApplicationProcessingFeePaid(id);

      const financingTypeSubmit = application.financing_type as
        | { product_id?: string }
        | null
        | undefined;
      const submitProductId = financingTypeSubmit?.product_id;
      let submitProductWorkflow: Prisma.JsonValue | undefined;
      if (submitProductId) {
        frozenSubmitWorkflow = await this.getProductWorkflowForApplication(application);
        const skipCategoryKeys =
          readFinancingStructureType(application.financing_structure) === "existing_contract"
            ? getFacilityLockedCategoriesFromWorkflow(frozenSubmitWorkflow)
            : [];
        validationRule = "REQUIRED_SUPPORTING_DOCUMENTS_PRESENT";
        assertRequiredSupportingDocumentsPresent(
          frozenSubmitWorkflow,
          application.supporting_documents,
          { skipCategoryKeys }
        );
        validationRule = "PRODUCT_RULES_ON_SUBMIT";
        assertProductRulesForSubmit(frozenSubmitWorkflow, {
          invoices: (application as { invoices?: Array<{
            status?: string | null;
            details?: unknown;
            contract_id?: string | null;
          }> }).invoices ?? [],
          contract: submitContract,
          applicationContractId:
            submitContract?.id ??
            (application as { contract_id?: string | null }).contract_id ??
            null,
          structureType: readFinancingStructureType(application.financing_structure),
        });
        submitProductWorkflow = frozenSubmitWorkflow as Prisma.JsonValue;
      }
      validationRule = "FINANCIAL_STATEMENTS_READY_FOR_SUBMIT";
      assertFinancialStatementsReadyForInitialSubmitIfActive(
        frozenSubmitWorkflow,
        application.financial_statements
      );
      const appFull = await prisma.application.findUnique({
        where: { id },
        include: {
          contract: true,
          invoices: true,
          issuer_organization: true,
          application_guarantors: { orderBy: { position: "asc" } },
        },
      });

      // Enforce required financial inputs at submit-time using resolved values
      // (CTOS + issuer inputs + Admin overrides).
      const latestCtosReport = await prisma.ctosReport.findFirst({
        where: {
          issuer_organization_id: application.issuer_organization_id,
          subject_ref: null,
        },
        orderBy: { fetched_at: "desc" },
        select: { financials_json: true },
      });
      assertRequiredFinancialFieldsForInitialSubmit({
        financialStatements: appFull?.financial_statements ?? application.financial_statements,
        ctosFinancials: latestCtosReport?.financials_json ?? null,
        now: new Date(),
      });
      if (appFull?.contract_id) {
        downstreamIntegration = "PAYMASTER_LINK";
        const linkedContract = await linkPaymasterForApplicationSubmission({
          contractId: appFull.contract_id,
          issuerOrganizationId: application.issuer_organization_id,
          applicationId: id,
          actorUserId: userId,
          auditContext: logContext?.context,
        });
        if (linkedContract && appFull.contract) {
          appFull.contract = {
            ...appFull.contract,
            ...linkedContract,
          } as typeof appFull.contract;
        }
      }
      if (appFull) {
        pendingInitialSubmitRevision = {
          snapshot: buildApplicationRevisionSnapshot({
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
          }),
          reviewCycle: (appFull as { review_cycle?: number }).review_cycle ?? 1,
        };
      }
    }

    // Resubmit flow is handled by dedicated resubmitApplication method to keep behavior deterministic.
    if (currentStatus === "AMENDMENT_REQUESTED" && status === "RESUBMITTED") {
      validationRule = "RESUBMIT_FLOW";
      const res = await this.resubmitApplication(id, userId, logContext);
      logApplicationFlowEvent({
        level: "info",
        event: "APPLICATION_STATUS_ACTION_SUCCESS",
        result: "SUCCESS",
        correlationId: logContext?.context?.correlationId ?? null,
        applicationId: id,
        applicationReference,
        productId,
        productCode,
        productVersion,
        issuerOrganizationId: application.issuer_organization_id,
        userId,
        action: status,
        applicationStatus: status,
        previousStatus,
        durationMs: Date.now() - startMs,
        endpoint: options?.request?.endpoint ?? null,
        method: options?.request?.method ?? null,
        downstreamIntegration,
        validationRule,
      });
      // return updated application
      return res as any;
    }

    // If submitting, perform cleanup of unused steps
    if (status === "SUBMITTED") {
      validationRule = "ISSUER_ORG_DIRECTOR_SHAREHOLDER_ONBOARDING_READY";
      await assertIssuerOrgDirectorShareholderOnboardingReady(application.issuer_organization_id);
      validationRule = "ISSUER_PROFILE_COMPLETE_FOR_SUBMIT";
      await assertIssuerProfileCompleteForSubmit(application.issuer_organization_id);
      // Get product to find active steps
      const financingType = application.financing_type as any;
      const productId = financingType?.product_id;

      if (productId) {
        const workflow = (frozenSubmitWorkflow ??
          (await this.getProductWorkflowForApplication(application))) as { id?: unknown }[];
        if (workflow) {
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

      const persistSubmittedApplication = async (tx: Prisma.TransactionClient) => {
        if (pendingInitialSubmitRevision) {
          const revision = await tx.applicationRevision.create({
            data: {
              application_id: id,
              review_cycle: pendingInitialSubmitRevision.reviewCycle,
              snapshot: pendingInitialSubmitRevision.snapshot,
              submitted_at: new Date(),
            },
          });

          // Org-level history / future ComRep source. Not an application prefill fallback.
          // Only happens on submit (not draft save). Invoice-only uses the same snapshot semantics.
          await upsertLatestOrganizationFinancialStatementsFromApplication({
            applicationId: id,
            sourceApplicationRevisionId: revision.id,
            db: tx,
          });
        }

        await tx.invoice.updateMany({
          where: { application_id: id, status: "DRAFT" as any },
          data: { status: "SUBMITTED" as any },
        });

        const contractId = application.contract_id;
        if (contractId) {
          const contract = await tx.contract.findUnique({
            where: { id: contractId },
            select: { status: true, contract_details: true },
          });
          if (readFinancingStructureType(application.financing_structure) === "existing_contract") {
            assertFacilityFeeUpfrontSettled(contract?.contract_details);
          }
          if ((contract as { status?: string } | null)?.status === "DRAFT") {
            const cd =
              contract?.contract_details && typeof contract.contract_details === "object"
                ? (contract.contract_details as Record<string, unknown>)
                : {};
            assertFacilityBelowContractValue({
              contractValue: resolveContractValue(cd),
              requestedFacility: resolveRequestedFacility(cd),
              approvedFacility: 0,
              contractId,
            });
            await tx.contract.update({
              where: { id: contractId },
              data: { status: "SUBMITTED" as any },
            });
          }
        }

        if (readFinancingStructureType(application.financing_structure) === "existing_contract") {
          await tx.applicationGuarantor.deleteMany({ where: { application_id: id } });
        }

        await tx.application.update({
          where: { id },
          data: updateData,
        });

        await logApplicationActivity(
          {
            userId,
            applicationId: id,
            eventType: ApplicationLogEventType.APPLICATION_SUBMITTED,
            reviewCycle: application.review_cycle,
            portal: ActivityPortal.ISSUER,
            ipAddress: logContext?.ipAddress,
            userAgent: logContext?.userAgent,
            context: logContext?.context,
          },
          tx
        );
      };

      const capacityContractId = isInvoiceOnlyFinancingStructure(application.financing_structure)
        ? null
        : application.contract_id;
      if (capacityContractId) {
        downstreamIntegration = "CONTRACT_CAPACITY_CHANGE";
        await applyContractCapacityChange(capacityContractId, prisma, persistSubmittedApplication, {
          assertWrite: true,
        });
      } else {
        await prisma.$transaction(persistSubmittedApplication);
      }
      const submitted = await this.repository.findById(id);
      if (!submitted) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to fetch updated application");
      }

      try {
        await this.sendIssuerNotification(
          id,
          NotificationTypeIds.APPLICATION_SUBMITTED_CONFIRMATION,
          { applicationId: id },
          "submitted"
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId: id },
          "Failed to send application submitted confirmation notification"
        );
      }

      logApplicationFlowEvent({
        level: "info",
        event: "APPLICATION_STATUS_ACTION_SUCCESS",
        result: "SUCCESS",
        correlationId: logContext?.context?.correlationId ?? null,
        applicationId: id,
        applicationReference,
        productId,
        productCode,
        productVersion,
        issuerOrganizationId: application.issuer_organization_id,
        userId,
        action: status,
        applicationStatus: status,
        previousStatus,
        durationMs: Date.now() - startMs,
        endpoint: options?.request?.endpoint ?? null,
        method: options?.request?.method ?? null,
        downstreamIntegration,
        validationRule,
      });

      return submitted;
    }

    logApplicationFlowEvent({
      level: "info",
      event: "APPLICATION_STATUS_ACTION_SUCCESS",
      result: "SUCCESS",
      correlationId: logContext?.context?.correlationId ?? null,
      applicationId: id,
      applicationReference,
      productId,
      productCode,
      productVersion,
      issuerOrganizationId: application.issuer_organization_id,
      userId,
      action: status,
      applicationStatus: status,
      previousStatus,
      durationMs: Date.now() - startMs,
      endpoint: options?.request?.endpoint ?? null,
      method: options?.request?.method ?? null,
      downstreamIntegration,
      validationRule,
    });

    return this.repository.update(id, updateData);
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const isAppError = err instanceof AppError;
      const isUserFailure = isAppError && err.statusCode >= 400 && err.statusCode < 500;

      if (isUserFailure) {
        logApplicationFlowEvent({
          level: "warn",
          event: "APPLICATION_STATUS_VALIDATION_FAILED",
          result: "VALIDATION_FAILED",
          correlationId: logContext?.context?.correlationId ?? null,
          applicationId: id,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          action: status,
          applicationStatus: status,
          previousStatus,
          durationMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
          downstreamIntegration,
          validationRule,
          errorCode: err.code,
          errorType: err.name,
          safeErrorMessage: err.message,
        });
      } else {
        const errorStack = err instanceof Error ? err.stack ?? null : null;
        logApplicationFlowEvent({
          level: "error",
          event: "APPLICATION_STATUS_ACTION_FAILED",
          result: "FAILED",
          correlationId: logContext?.context?.correlationId ?? null,
          applicationId: id,
          applicationReference,
          productId,
          productCode,
          productVersion,
          issuerOrganizationId: application.issuer_organization_id,
          userId,
          action: status,
          applicationStatus: status,
          previousStatus,
          durationMs,
          endpoint: options?.request?.endpoint ?? null,
          method: options?.request?.method ?? null,
          downstreamIntegration,
          validationRule,
          errorCode: isAppError ? err.code : "UNEXPECTED_ERROR",
          errorType: err instanceof Error ? err.name : "UnknownError",
          safeErrorMessage: safeServerErrorMessage(err),
          errorStack,
        });
      }
      throw err;
    }
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
   * Reset acceptance-doc review items + section to PENDING on (re)submit.
   * From CHANGES_REQUESTED: only AMENDMENT_REQUESTED items (approved stay approved).
   * From PENDING_ISSUER: initialize/reset all uploaded acceptance keys.
   */
  private async resetAcceptanceDocumentsReviewInTx(
    tx: Prisma.TransactionClient,
    applicationId: string,
    application: {
      acceptance_documents?: unknown;
    },
    workflow: unknown[],
    offerAcceptanceStatus: string | null | undefined
  ): Promise<void> {
    const allDocKeys = collectAcceptanceDocumentReviewKeys(
      workflow,
      application.acceptance_documents
    );
    const reviewItems =
      offerAcceptanceStatus === "CHANGES_REQUESTED"
        ? await tx.applicationReviewItem.findMany({
            where: { application_id: applicationId, item_type: "document" },
            select: { item_type: true, item_id: true, status: true },
          })
        : [];
    const docKeys = resolveAcceptanceDocumentReviewKeysToResetOnSubmit(
      offerAcceptanceStatus,
      allDocKeys,
      reviewItems
    );
    await Promise.all(
      docKeys.map(async (itemId) => {
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
        await tx.applicationReviewRemark.deleteMany({
          where: {
            application_id: applicationId,
            scope: "item",
            scope_key: itemId,
          },
        });
      })
    );
    if (allDocKeys.length === 0 && !workflowHasAcceptanceDocuments(workflow)) {
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
   * Prisma recreates `application_guarantors` on business-details save, so review
   * item ids that embed those ids must move with the live rows.
   */
  private async remapAuthorizedRepresentativeReviewItemsInTx(
    tx: Prisma.TransactionClient,
    applicationId: string,
    previous: AuthorizedPartiesSnapshot,
    nextParties: AuthorizedPartiesSnapshot["parties"],
    guarantors: ApplicationGuarantorForParties[]
  ): Promise<void> {
    const remaps = authorizedRepresentativeReviewItemIdRemap(previous, nextParties, guarantors);
    for (const { from, to } of remaps) {
      const fromWhere = {
        application_id_item_type_item_id: {
          application_id: applicationId,
          item_type: AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
          item_id: from,
        },
      } as const;
      const toWhere = {
        application_id_item_type_item_id: {
          application_id: applicationId,
          item_type: AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
          item_id: to,
        },
      } as const;
      const fromRow = await tx.applicationReviewItem.findUnique({ where: fromWhere });
      if (!fromRow) continue;
      const toRow = await tx.applicationReviewItem.findUnique({ where: toWhere });
      if (!toRow) {
        await tx.applicationReviewItem.create({
          data: {
            application_id: applicationId,
            item_type: AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
            item_id: to,
            status: fromRow.status,
            reviewer_user_id: fromRow.reviewer_user_id,
            reviewed_at: fromRow.reviewed_at,
          },
        });
      } else {
        await tx.applicationReviewItem.update({
          where: toWhere,
          data: {
            status: fromRow.status,
            reviewer_user_id: fromRow.reviewer_user_id,
            reviewed_at: fromRow.reviewed_at,
          },
        });
        await tx.applicationReviewRemark.deleteMany({
          where: { application_id: applicationId, scope: "item", scope_key: to },
        });
      }
      await tx.applicationReviewRemark.updateMany({
        where: { application_id: applicationId, scope: "item", scope_key: from },
        data: { scope_key: to },
      });
      await tx.applicationReviewItem.delete({ where: fromWhere });
    }
  }

  /**
   * Reset authorised-representative review items to PENDING on (re)submit.
   * From CHANGES_REQUESTED: only AMENDMENT_REQUESTED items (approved stay approved).
   */
  private async resetAuthorizedRepresentativesReviewInTx(
    tx: Prisma.TransactionClient,
    applicationId: string,
    snapshot: AuthorizedPartiesSnapshot | null | undefined,
    offerAcceptanceStatus: string | null | undefined,
    previousSnapshot?: AuthorizedPartiesSnapshot | null,
    guarantors: ApplicationGuarantorForParties[] = [],
    reviewItems: Array<{ item_type: string; item_id: string; status: string }> = []
  ): Promise<void> {
    const allPartyKeys = collectAuthorizedRepresentativeReviewKeys(snapshot);
    if (allPartyKeys.length === 0) return;
    if (
      offerAcceptanceStatus === "CHANGES_REQUESTED" &&
      previousSnapshot &&
      snapshot &&
      guarantors.length > 0
    ) {
      await this.remapAuthorizedRepresentativeReviewItemsInTx(
        tx,
        applicationId,
        previousSnapshot,
        snapshot.parties,
        guarantors
      );
    }
    const partyKeys = resolveAuthorizedRepresentativeReviewKeysToResetOnSubmit(
      offerAcceptanceStatus,
      allPartyKeys,
      reviewItems,
      previousSnapshot && snapshot
        ? {
            previous: previousSnapshot,
            nextParties: snapshot.parties,
            guarantors,
          }
        : undefined
    );
    await Promise.all(
      partyKeys.map(async (itemId) => {
        await tx.applicationReviewItem.upsert({
          where: {
            application_id_item_type_item_id: {
              application_id: applicationId,
              item_type: AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
              item_id: itemId,
            },
          },
          create: {
            application_id: applicationId,
            item_type: AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
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
        await tx.applicationReviewRemark.deleteMany({
          where: {
            application_id: applicationId,
            scope: "item",
            scope_key: itemId,
          },
        });
      })
    );
  }

  private async patchFlaggedIndividualGuarantorIdentityInTx(
    tx: Prisma.TransactionClient,
    applicationId: string,
    parties: AuthorizedPartiesSnapshot["parties"],
    flaggedItemIds: ReadonlySet<string>
  ): Promise<void> {
    for (const party of flaggedIndividualGuarantorParties(parties, flaggedItemIds)) {
      const identity = identityFromIndividualGuarantorParty(party);
      if (!identity) continue;
      const row = await tx.applicationGuarantor.findFirst({
        where: party.client_guarantor_id
          ? { application_id: applicationId, client_guarantor_id: party.client_guarantor_id }
          : { application_id: applicationId, id: party.application_guarantor_id },
      });
      if (!row || row.guarantor_type !== "individual") continue;
      const patch = buildIndividualGuarantorIdentityPatch({
        current: {
          name: row.name,
          email: row.email,
          ic_number: row.ic_number,
          source_data: row.source_data,
          metadata: row.metadata,
        },
        next: identity,
      });
      await tx.applicationGuarantor.update({
        where: { id: row.id },
        data: prismaDataForIndividualGuarantorIdentityPatch(patch),
      });
    }
  }

  private async persistAuthorizedRepresentativesOnAcceptanceSubmitInTx(
    tx: Prisma.TransactionClient,
    applicationId: string,
    authorizedParties: AuthorizedPartiesSnapshot,
    previousAcceptance:
      | {
          status?: string | null;
          authorized_parties?: AuthorizedPartiesSnapshot | null;
        }
      | null
      | undefined,
    guarantors: ApplicationGuarantorForParties[]
  ): Promise<void> {
    const previousStatus = previousAcceptance?.status ?? null;
    const partyReviewItems =
      previousStatus === "CHANGES_REQUESTED"
        ? await tx.applicationReviewItem.findMany({
            where: {
              application_id: applicationId,
              item_type: AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
            },
            select: { item_type: true, item_id: true, status: true },
          })
        : [];
    if (previousStatus === "CHANGES_REQUESTED") {
      const flaggedItemIds = collectFlaggedAuthorizedRepresentativeItemIds(partyReviewItems);
      assertUnflaggedAuthorizedPartiesUnchanged(
        previousAcceptance?.authorized_parties,
        authorizedParties.parties,
        flaggedItemIds,
        guarantors
      );
      await this.patchFlaggedIndividualGuarantorIdentityInTx(
        tx,
        applicationId,
        authorizedParties.parties,
        flaggedItemIds
      );
    }
    await this.resetAuthorizedRepresentativesReviewInTx(
      tx,
      applicationId,
      authorizedParties,
      previousStatus,
      previousAcceptance?.authorized_parties,
      guarantors,
      partyReviewItems
    );
  }

  private assertFacilityOfferApplication(application: { financing_structure?: unknown }): void {
    if (isInvoiceOnlyFinancingStructure(application.financing_structure)) {
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Standalone invoice applications do not have facility offers."
      );
    }
  }

  private async requireOfferAcceptanceWorkflow(application: Application) {
    const workflow = await this.getProductWorkflowForApplication(application);
    if (!workflowUsesOfferAcceptanceFlow(workflow)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        "This product does not use the offer acceptance flow."
      );
    }
    return workflow;
  }

  private async stampAuthorizedPartiesDraftForApplication(
    application: Application,
    userId: string,
    authorizedPartiesPayload: AuthorizedPartiesSubmitPayload,
    workflow: unknown
  ): Promise<{
    draft: AuthorizedPartiesSnapshot;
    guarantors: ReturnType<typeof applicationGuarantorsForParties>;
  }> {
    const directorPool = await loadIssuerDirectorPool(application.issuer_organization_id);
    const guarantors = applicationGuarantorsForParties(
      (application as { application_guarantors?: unknown }).application_guarantors
    );
    await assertAuthorizedPartiesForOffer(
      authorizedPartiesPayload.parties,
      directorPool,
      guarantors,
      {
        issuerOrganizationId: application.issuer_organization_id,
        workflow,
        mutableIndividualGuarantorItemIds:
          this.collectMutableIndividualGuarantorItemIds(application),
      }
    );
    return {
      draft: stampAuthorizedPartiesSnapshot({
        parties: authorizedPartiesPayload.parties,
        submittedByUserId: userId,
        submittedAt: new Date().toISOString(),
      }),
      guarantors,
    };
  }

  private async assertAuthorizedPartiesDraftMaySave(
    tx: Prisma.TransactionClient,
    applicationId: string,
    acceptance: ReturnType<typeof getOfferAcceptanceFromOfferDetails>,
    draft: AuthorizedPartiesSnapshot,
    guarantors: ReturnType<typeof applicationGuarantorsForParties>
  ): Promise<void> {
    if (!offerAcceptanceIsStep1Editable(acceptance?.status)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        "Offer acceptance has already been submitted or is not editable."
      );
    }
    assertAcceptanceDeadlineOpen(acceptance);
    if (acceptance?.status !== "CHANGES_REQUESTED") return;
    const partyReviewItems = await tx.applicationReviewItem.findMany({
      where: {
        application_id: applicationId,
        item_type: AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
      },
      select: { item_type: true, item_id: true, status: true },
    });
    assertUnflaggedAuthorizedPartiesUnchanged(
      acceptance.authorized_parties,
      draft.parties,
      collectFlaggedAuthorizedRepresentativeItemIds(partyReviewItems),
      guarantors
    );
  }

  async saveContractAuthorizedPartiesDraft(
    applicationId: string,
    userId: string,
    authorizedPartiesPayload: AuthorizedPartiesSubmitPayload
  ): Promise<Application> {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    this.assertFacilityOfferApplication(application);
    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no facility");
    }
    const workflow = await this.requireOfferAcceptanceWorkflow(application);
    const { draft, guarantors } = await this.stampAuthorizedPartiesDraftForApplication(
      application,
      userId,
      authorizedPartiesPayload,
      workflow
    );
    const contractId = application.contract_id;

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { status: string; offer_details: Prisma.JsonValue | null }[]
      >`SELECT status, offer_details FROM contracts WHERE id = ${contractId} FOR UPDATE`;
      const contract = locked[0];
      if (!contract || contract.status !== "OFFER_SENT") {
        throw new AppError(400, "INVALID_STATE", "No pending facility offer to update");
      }
      const offer = (contract.offer_details as Record<string, unknown> | null) ?? null;
      if (!offer) {
        throw new AppError(400, "INVALID_STATE", "Facility has no offer details");
      }
      const acceptance = getOfferAcceptanceFromOfferDetails(offer);
      await this.assertAuthorizedPartiesDraftMaySave(
        tx,
        applicationId,
        acceptance,
        draft,
        guarantors
      );
      const updatedOffer = patchOfferAcceptance(offer, {
        status: acceptance?.status ?? "PENDING_ISSUER",
        authorized_parties_draft: draft,
      });
      await tx.contract.update({
        where: { id: contractId },
        data: { offer_details: updatedOffer as Prisma.InputJsonValue },
      });
    });

    return this.repository.findById(applicationId) as Promise<Application>;
  }

  async saveInvoiceAuthorizedPartiesDraft(
    applicationId: string,
    invoiceId: string,
    userId: string,
    authorizedPartiesPayload: AuthorizedPartiesSubmitPayload
  ): Promise<Application> {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    const invoices =
      (application as { invoices?: { id: string; contract_id?: string | null }[] }).invoices ?? [];
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
    const workflow = await this.requireOfferAcceptanceWorkflow(application);
    const { draft, guarantors } = await this.stampAuthorizedPartiesDraftForApplication(
      application,
      userId,
      authorizedPartiesPayload,
      workflow
    );

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { status: string; offer_details: Prisma.JsonValue | null }[]
      >`SELECT status, offer_details FROM invoices WHERE id = ${invoiceId} AND application_id = ${applicationId} FOR UPDATE`;
      const row = locked[0];
      if (!row || row.status !== "OFFER_SENT") {
        throw new AppError(400, "INVALID_STATE", "No pending invoice offer to update");
      }
      const offer = (row.offer_details as Record<string, unknown> | null) ?? null;
      if (!offer) {
        throw new AppError(400, "INVALID_STATE", "Invoice has no offer details");
      }
      const acceptance = getOfferAcceptanceFromOfferDetails(offer);
      await this.assertAuthorizedPartiesDraftMaySave(
        tx,
        applicationId,
        acceptance,
        draft,
        guarantors
      );
      const updatedOffer = patchOfferAcceptance(offer, {
        status: acceptance?.status ?? "PENDING_ISSUER",
        authorized_parties_draft: draft,
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { offer_details: updatedOffer as Prisma.InputJsonValue },
      });
    });

    return this.repository.findById(applicationId) as Promise<Application>;
  }

  /**
   * Step 1 of offer acceptance: require acceptance uploads, issuer directors, and
   * one authorised-party list per guarantor, then move to PENDING_ADMIN_REVIEW
   * (or APPROVED_FOR_SIGNING when no acceptance docs).
   */
  async submitContractOfferAcceptance(
    applicationId: string,
    userId: string,
    authorizedPartiesPayload: AuthorizedPartiesSubmitPayload,
    logContext?: IssuerActivityLogContext
  ): Promise<Application> {
    await this.verifyApplicationAccess(applicationId, userId);
    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    this.assertFacilityOfferApplication(application);
    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no facility");
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
    assertRequiredAcceptanceDocumentsPresent(
      workflow,
      (application as { acceptance_documents?: unknown }).acceptance_documents
    );

    const directorPool = await loadIssuerDirectorPool(application.issuer_organization_id);
    const guarantors = applicationGuarantorsForParties(
      (application as { application_guarantors?: unknown }).application_guarantors
    );
    await assertAuthorizedPartiesForOffer(
      authorizedPartiesPayload.parties,
      directorPool,
      guarantors,
      {
        issuerOrganizationId: application.issuer_organization_id,
        workflow,
        mutableIndividualGuarantorItemIds:
          this.collectMutableIndividualGuarantorItemIds(application),
      }
    );

    const now = new Date().toISOString();
    const authorizedParties = stampAuthorizedPartiesSnapshot({
      parties: authorizedPartiesPayload.parties,
      submittedByUserId: userId,
      submittedAt: now,
    });
    const nextStatus = resolveStatusAfterOfferAcceptanceSubmit(workflow);
    let previousAcceptanceStatus: string | null = null;

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { status: string; offer_details: Prisma.JsonValue | null }[]
      >`SELECT status, offer_details FROM contracts WHERE id = ${contractId} FOR UPDATE`;
      const contract = locked[0];
      if (!contract || contract.status !== "OFFER_SENT") {
        throw new AppError(400, "INVALID_STATE", "No pending facility offer to accept");
      }
      const offer = (contract.offer_details as Record<string, unknown> | null) ?? null;
      if (!offer) {
        throw new AppError(400, "INVALID_STATE", "Facility has no offer details");
      }
      const acceptance = getOfferAcceptanceFromOfferDetails(offer);
      previousAcceptanceStatus = acceptance?.status ?? null;
      if (!offerAcceptanceIsStep1Editable(acceptance?.status)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Offer acceptance has already been submitted or is not editable."
        );
      }
      assertAcceptanceDeadlineOpen(acceptance);
      const productVersion =
        (application as { product_version?: number | null }).product_version ?? null;
      const updatedOffer = patchOfferAcceptance(offer, {
        status: nextStatus,
        acknowledged_terms: buildAcknowledgedTermsSnapshot({
          offerDetails: offer,
          productVersion,
        }),
        authorized_parties: authorizedParties,
        authorized_parties_draft: null,
        submitted_at: now,
        reviewed_at: nextStatus === "APPROVED_FOR_SIGNING" ? now : null,
        reviewed_by_user_id: nextStatus === "APPROVED_FOR_SIGNING" ? userId : null,
      });
      await tx.contract.update({
        where: { id: contractId },
        data: { offer_details: updatedOffer as Prisma.InputJsonValue },
      });
      await this.resetAcceptanceDocumentsReviewInTx(
        tx,
        applicationId,
        application,
        workflow,
        acceptance?.status
      );
      await this.persistAuthorizedRepresentativesOnAcceptanceSubmitInTx(
        tx,
        applicationId,
        authorizedParties,
        acceptance,
        guarantors
      );
    });

    const contractNumber = (
      application as {
        contract?: { contract_details?: { number?: string | number } | null } | null;
      }
    ).contract?.contract_details?.number;
    const offerRecord =
      (
        application as {
          contract?: { offer_details?: Record<string, unknown> | null } | null;
        }
      ).contract?.offer_details ?? null;

    const isAcceptanceResubmit = previousAcceptanceStatus === "CHANGES_REQUESTED";
    await logApplicationActivity({
      userId,
      applicationId,
      entityId: contractId,
      portal: ActivityPortal.ISSUER,
      eventType: isAcceptanceResubmit
        ? ApplicationLogEventType.CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED
        : ApplicationLogEventType.CONTRACT_OFFER_ACCEPTANCE_SUBMITTED,
      metadata: {
        contract_id: contractId,
        ...(contractNumber != null && String(contractNumber).trim() !== ""
          ? { contract_number: String(contractNumber).trim() }
          : {}),
        offer_acceptance_status: nextStatus,
        submitted_at: now,
        submitted_by_user_id: userId,
        authorized_parties: summarizeAuthorizedParties(authorizedParties),
        ...(isAcceptanceResubmit ? { resubmitted_from: "CHANGES_REQUESTED" } : {}),
        ...(offerRecord?.offered_facility != null
          ? { offered_facility: Number(offerRecord.offered_facility) || 0 }
          : {}),
        ...(offerRecord?.requested_facility != null
          ? { requested_facility: Number(offerRecord.requested_facility) || 0 }
          : {}),
      },
      ...logContext,
    });

    if (nextStatus === "APPROVED_FOR_SIGNING") {
      await logApplicationActivity({
        userId,
        applicationId,
        entityId: contractId,
        portal: ActivityPortal.ISSUER,
        eventType: ApplicationLogEventType.CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING,
        metadata: {
          contract_id: contractId,
          ...(contractNumber != null && String(contractNumber).trim() !== ""
            ? { contract_number: String(contractNumber).trim() }
            : {}),
          auto_approved: true,
        },
        ...logContext,
      });
    }

    const isInvoiceOnly =
      (application as { financing_structure?: { structure_type?: string } }).financing_structure
        ?.structure_type === "invoice_only";
    const appStatus = resolveApplicationStatusAfterOfferAcceptanceSubmit(isInvoiceOnly, nextStatus);
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: appStatus as DbApplicationStatus },
    });

    return this.repository.findById(applicationId) as Promise<Application>;
  }

  async submitInvoiceOfferAcceptance(
    applicationId: string,
    invoiceId: string,
    userId: string,
    authorizedPartiesPayload: AuthorizedPartiesSubmitPayload,
    logContext?: IssuerActivityLogContext
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
    const invoices =
      (application as { invoices?: { id: string; contract_id?: string | null }[] }).invoices ?? [];
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
    assertRequiredAcceptanceDocumentsPresent(
      workflow,
      (application as { acceptance_documents?: unknown }).acceptance_documents
    );

    const directorPool = await loadIssuerDirectorPool(application.issuer_organization_id);
    const guarantors = applicationGuarantorsForParties(
      (application as { application_guarantors?: unknown }).application_guarantors
    );
    await assertAuthorizedPartiesForOffer(
      authorizedPartiesPayload.parties,
      directorPool,
      guarantors,
      {
        issuerOrganizationId: application.issuer_organization_id,
        workflow,
        mutableIndividualGuarantorItemIds:
          this.collectMutableIndividualGuarantorItemIds(application),
      }
    );

    const now = new Date().toISOString();
    const authorizedParties = stampAuthorizedPartiesSnapshot({
      parties: authorizedPartiesPayload.parties,
      submittedByUserId: userId,
      submittedAt: now,
    });
    const nextStatus = resolveStatusAfterOfferAcceptanceSubmit(workflow);
    let previousAcceptanceStatus: string | null = null;

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
      previousAcceptanceStatus = acceptance?.status ?? null;
      if (!offerAcceptanceIsStep1Editable(acceptance?.status)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Offer acceptance has already been submitted or is not editable."
        );
      }
      assertAcceptanceDeadlineOpen(acceptance);
      const productVersion =
        (application as { product_version?: number | null }).product_version ?? null;
      const updatedOffer = patchOfferAcceptance(offer, {
        status: nextStatus,
        acknowledged_terms: buildAcknowledgedTermsSnapshot({
          offerDetails: offer,
          productVersion,
        }),
        authorized_parties: authorizedParties,
        authorized_parties_draft: null,
        submitted_at: now,
        reviewed_at: nextStatus === "APPROVED_FOR_SIGNING" ? now : null,
        reviewed_by_user_id: nextStatus === "APPROVED_FOR_SIGNING" ? userId : null,
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { offer_details: updatedOffer as Prisma.InputJsonValue },
      });
      await this.resetAcceptanceDocumentsReviewInTx(
        tx,
        applicationId,
        application,
        workflow,
        acceptance?.status
      );
      await this.persistAuthorizedRepresentativesOnAcceptanceSubmitInTx(
        tx,
        applicationId,
        authorizedParties,
        acceptance,
        guarantors
      );
    });

    const invWithDetails = (
      application as {
        invoices?: {
          id: string;
          details?: { number?: string | number };
          offer_details?: Record<string, unknown> | null;
        }[];
      }
    ).invoices?.find((item) => item.id === invoiceId);
    const invoiceNumber =
      invWithDetails?.details?.number != null && String(invWithDetails.details.number).trim() !== ""
        ? String(invWithDetails.details.number).trim()
        : undefined;
    const offerRecord = invWithDetails?.offer_details ?? null;

    const isAcceptanceResubmit = previousAcceptanceStatus === "CHANGES_REQUESTED";
    await logApplicationActivity({
      userId,
      applicationId,
      entityId: invoiceId,
      portal: ActivityPortal.ISSUER,
      eventType: isAcceptanceResubmit
        ? ApplicationLogEventType.INVOICE_OFFER_ACCEPTANCE_RESUBMITTED
        : ApplicationLogEventType.INVOICE_OFFER_ACCEPTANCE_SUBMITTED,
      metadata: {
        invoice_id: invoiceId,
        ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}),
        offer_acceptance_status: nextStatus,
        submitted_at: now,
        submitted_by_user_id: userId,
        authorized_parties: summarizeAuthorizedParties(authorizedParties),
        ...(isAcceptanceResubmit ? { resubmitted_from: "CHANGES_REQUESTED" } : {}),
        ...(offerRecord?.offered_amount != null
          ? { offered_amount: Number(offerRecord.offered_amount) || 0 }
          : {}),
        ...(offerRecord?.requested_amount != null
          ? { requested_amount: Number(offerRecord.requested_amount) || 0 }
          : {}),
      },
      ...logContext,
    });

    if (nextStatus === "APPROVED_FOR_SIGNING") {
      await logApplicationActivity({
        userId,
        applicationId,
        entityId: invoiceId,
        portal: ActivityPortal.ISSUER,
        eventType: ApplicationLogEventType.INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING,
        metadata: {
          invoice_id: invoiceId,
          ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}),
          auto_approved: true,
        },
        ...logContext,
      });
    }

    const isInvoiceOnly =
      (application as { financing_structure?: { structure_type?: string } }).financing_structure
        ?.structure_type === "invoice_only";
    const appStatus = resolveApplicationStatusAfterOfferAcceptanceSubmit(isInvoiceOnly, nextStatus);
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: appStatus as DbApplicationStatus },
    });

    return this.repository.findById(applicationId) as Promise<Application>;
  }

  /**
   * Phased offer products must complete via envelope.
   * Prevents silent direct accept when SigningCloud env is missing/misconfigured.
   */
  private async assertPhasedOfferDirectAcceptBlocked(params: {
    application: Application;
    action: "accept" | "reject";
    signingCompletion?: { signedOfferLetterS3Key: string; signedFileSha256: string };
    invoiceId?: string;
  }): Promise<void> {
    if (params.action !== "accept") return;
    if (params.signingCompletion) return;

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
          "Finish facility signing before accepting this invoice offer."
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
    userId: string | null,
    rejectionReason?: string,
    options?: {
      signingCompletion?: { signedOfferLetterS3Key: string; signedFileSha256: string };
      logContext?: IssuerActivityLogContext;
    }
  ): Promise<Application> {
    if (userId) {
      await this.verifyApplicationAccess(applicationId, userId);
    } else if (!options?.signingCompletion) {
      throw new AppError(401, "UNAUTHORIZED", "Actor required to respond to this offer.");
    }

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    this.assertFacilityOfferApplication(application);
    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no facility");
    }
    await this.assertPhasedOfferDirectAcceptBlocked({
      application,
      action,
      signingCompletion: options?.signingCompletion,
    });
    const contractId = application.contract_id;
    const workflow = await this.getProductWorkflowForApplication(application);

    const { result: responseMeta } = await applyContractCapacityChange(
      contractId,
      prisma,
      async (tx) => {
        const lockedContractRows = await tx.$queryRaw<
          {
            status: string;
            offer_details: Prisma.JsonValue | null;
            contract_details: Prisma.JsonValue | null;
            originating_application_id: string | null;
          }[]
        >`SELECT status, offer_details, contract_details, originating_application_id FROM contracts WHERE id = ${contractId} FOR UPDATE`;

        const contract = lockedContractRows[0];
        if (!contract) {
          throw new AppError(404, "NOT_FOUND", "Facility not found");
        }

        if (contract.status !== "OFFER_SENT") {
          throw new AppError(400, "INVALID_STATE", "No pending facility offer to respond to");
        }

        const offer = contract.offer_details as Record<string, unknown> | null;
        if (!offer || typeof offer !== "object") {
          throw new AppError(400, "INVALID_STATE", "Facility has no offer details");
        }

        assertAcceptanceDeadlineOpen(getOfferAcceptanceFromOfferDetails(offer));
        assertSigningDeadlineOpen(getOfferAcceptanceFromOfferDetails(offer));

        if (offer.responded_at != null && offer.responded_at !== "") {
          throw new AppError(400, "ALREADY_RESPONDED", "This offer has already been responded to");
        }

        const now = new Date().toISOString();
        /** Issuer rejecting offer = withdraw financing request. Admin reject = REJECTED. */
        const newStatus = action === "accept" ? "APPROVED" : "WITHDRAWN";
        const offeredFacility = resolveOfferedFacility(offer);
        const requestedFacility = Number(offer.requested_facility) || 0;
        const contractDetailsForValue =
          (contract.contract_details as Record<string, unknown> | null) ?? {};
        if (action === "accept") {
          assertFacilityBelowContractValue({
            contractValue: resolveContractValue(contractDetailsForValue),
            requestedFacility,
            approvedFacility: offeredFacility,
            contractId,
          });
        }
        const facilityFeeRatePercentRaw =
          typeof offer.facility_fee_rate_percent === "number" ? offer.facility_fee_rate_percent : 0;
        const facilityFeeRatePercent = Number.isFinite(facilityFeeRatePercentRaw)
          ? facilityFeeRatePercentRaw
          : 0;
        const facilityFeeTotalAmount = computeFacilityFeeTotalOwed(
          offeredFacility,
          facilityFeeRatePercent
        );
        const rawUpfront = parseFiniteNumber(offer.facility_fee_upfront_collect_amount) ?? 0;
        const facilityFeeUpfrontAmount = roundNoteMoney(
          Math.min(Math.max(0, rawUpfront), facilityFeeTotalAmount)
        );

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
        const existingPaid =
          typeof cd.facility_fee_paid_amount === "number" &&
          Number.isFinite(cd.facility_fee_paid_amount)
            ? (cd.facility_fee_paid_amount as number)
            : 0;
        const mergedDetails =
          action === "accept"
            ? {
                ...cd,
                approved_facility: offeredFacility,
                facility_fee_rate_percent: facilityFeeRatePercent,
                facility_fee_total_amount: facilityFeeTotalAmount,
                facility_fee_paid_amount: existingPaid,
                facility_fee_upfront_amount: facilityFeeUpfrontAmount,
                facility_fee_waived: false,
                facility_enabled: true,
              }
            : cd;

        await tx.contract.update({
          where: { id: contractId },
          data: {
            status: newStatus,
            offer_details: updatedOffer as Prisma.InputJsonValue,
            contract_details: mergedDetails as Prisma.InputJsonValue,
            ...(action === "reject" && { withdraw_reason: WithdrawReason.OFFER_REJECTED }),
            ...(action === "accept" && contract.originating_application_id == null
              ? { originating_application_id: applicationId }
              : {}),
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
        if (action === "accept" && workflowShowsAcceptanceReviewSection(workflow)) {
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
        const isInvoiceOnly =
          (application as { financing_structure?: { structure_type?: string } }).financing_structure
            ?.structure_type === "invoice_only";
        const structureType =
          (application as { financing_structure?: { structure_type?: string } }).financing_structure
            ?.structure_type ?? null;
        const hasOfferAcceptance = !!getOfferAcceptanceFromOfferDetails(offer);
        const sectionReviews = await tx.applicationReview.findMany({
          where: { application_id: applicationId },
          select: { section: true, status: true },
        });
        const sectionStatusMap = new Map(sectionReviews.map((r) => [r.section, r.status]));
        // Contract accept just wrote contract_details → APPROVED in this transaction.
        if (action === "accept") {
          sectionStatusMap.set("contract_details", ReviewStepStatus.APPROVED);
        }
        const invoicePrereqs = getReviewSectionPrerequisites(structureType).invoice_details ?? [];
        const isInvoiceTabUnlocked =
          invoicePrereqs.length === 0 ||
          invoicePrereqs.every(
            (prereq) => sectionStatusMap.get(prereq) === ReviewStepStatus.APPROVED
          );
        const phasedAcceptStatus = resolveApplicationStatusAfterCommercialAccept({
          isInvoiceOnly,
          hasOfferAcceptance,
          action,
          isContractPath: true,
          invoiceCount: updatedInvoices.length,
          isInvoiceTabUnlocked,
        });
        const nextReviewStatusBase =
          action === "accept"
            ? (phasedAcceptStatus ?? ApplicationStatus.CONTRACT_ACCEPTED)
            : (application.status as ApplicationStatus);
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

        return {
          offeredFacility,
          requestedFacility,
          now,
          appStatus,
          facilityFeeUpfrontAmount: action === "accept" ? facilityFeeUpfrontAmount : 0,
        };
      },
      { assertWrite: true }
    );

    const eventType = action === "accept" ? "CONTRACT_OFFER_ACCEPTED" : "CONTRACT_OFFER_DECLINED";
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
      ...(options?.logContext ?? {}),
    });
    if (action === "accept" && responseMeta.facilityFeeUpfrontAmount > 0) {
      try {
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.FACILITY_FEE_PAYMENT_REQUESTED,
          {
            applicationId,
            contractId,
            upfrontAmount: responseMeta.facilityFeeUpfrontAmount,
          },
          `facility-fee-payment:${contractId}`
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId, contractId },
          "Failed to send facility fee payment requested notification"
        );
      }
    }
    if (responseMeta.appStatus === ApplicationStatus.WITHDRAWN) {
      try {
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.APPLICATION_WITHDRAWN_CONFIRMATION,
          { applicationId, withdrawalReason: "contract_offer_declined" },
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
        ...(options?.logContext ?? {}),
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
        "Finish facility signing before accepting this invoice offer."
      );
    }

    throw new AppError(
      400,
      "USE_SIGNING_FLOW",
      "Complete signing via the signing envelope before accepting this offer."
    );
  }

  private async loadInvoiceOfferAcceptSignatories(params: {
    applicationId: string;
    invoiceId: string;
  }): Promise<{
    invoice: {
      id: string;
      contract_id: string;
      offer_details: Prisma.JsonValue | null;
      details: Prisma.JsonValue;
      display_reference: string | null;
    };
    contract: { id: string; display_reference: string | null };
    signatories: ReturnType<typeof resolveOfferAcceptSignatories>["signatories"];
    source: ReturnType<typeof resolveOfferAcceptSignatories>["source"];
  }> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: params.invoiceId, application_id: params.applicationId },
      select: {
        id: true,
        contract_id: true,
        status: true,
        offer_details: true,
        details: true,
        display_reference: true,
        contract: { select: { id: true, display_reference: true } },
        application: {
          select: {
            issuer_organization_id: true,
          },
        },
      },
    });
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found in this application");
    }
    if (!invoice.contract_id || !invoice.contract) {
      throw new AppError(
        400,
        "USE_SIGNING_FLOW",
        "Complete signing via the signing envelope before accepting this offer."
      );
    }
    if (invoice.status !== "OFFER_SENT") {
      throw new AppError(400, "INVALID_STATE", "No pending invoice offer to respond to");
    }

    const envelope = await prisma.signingEnvelope.findFirst({
      where: { contract_id: invoice.contract_id, status: "COMPLETED" },
      orderBy: { completed_at: "desc" },
      select: {
        recipients: { select: { role_key: true, name: true, email: true, status: true } },
      },
    });

    const envelopeResolved = resolveOfferAcceptEnvelopeSignatories(envelope?.recipients ?? []);
    if (envelopeResolved) {
      return {
        invoice: {
          id: invoice.id,
          contract_id: invoice.contract_id,
          offer_details: invoice.offer_details,
          details: invoice.details,
          display_reference: invoice.display_reference,
        },
        contract: invoice.contract,
        ...envelopeResolved,
      };
    }

    const issuerOrganization = await prisma.application.findUnique({
      where: { id: params.applicationId },
      select: {
        issuer_organization: {
          select: {
            corporate_entities: true,
            director_kyc_status: true,
            director_aml_status: true,
          },
        },
      },
    });
    const extras = await new OrganizationService().getIssuerPartyListExtras(
      invoice.application.issuer_organization_id
    );
    const people = buildAdminPeopleList({
      ctos: extras.latestOrganizationCtosCompanyJson ?? null,
      issuerDirectorKycStatus: issuerOrganization?.issuer_organization?.director_kyc_status ?? null,
      issuerDirectorAmlStatus: issuerOrganization?.issuer_organization?.director_aml_status ?? null,
      ctosPartySupplements: extras.ctosPartySupplements,
      corporateEntities: issuerOrganization?.issuer_organization?.corporate_entities ?? null,
    });
    const resolved = resolveOfferAcceptSignatories({
      envelopeRecipients: envelope?.recipients ?? [],
      orgDirectors: people,
    });

    return {
      invoice: {
        id: invoice.id,
        contract_id: invoice.contract_id,
        offer_details: invoice.offer_details,
        details: invoice.details,
        display_reference: invoice.display_reference,
      },
      contract: invoice.contract,
      ...resolved,
    };
  }

  async listInvoiceOfferAcceptSignatories(
    applicationId: string,
    invoiceId: string,
    userId: string
  ): Promise<{
    source: ReturnType<typeof resolveOfferAcceptSignatories>["source"];
    signatories: ReturnType<typeof resolveOfferAcceptSignatories>["signatories"];
  }> {
    await this.assertInvoiceOfferAcceptAllowed(applicationId, invoiceId, userId);
    const loaded = await this.loadInvoiceOfferAcceptSignatories({ applicationId, invoiceId });
    return { source: loaded.source, signatories: loaded.signatories };
  }

  async requestInvoiceOfferAcceptOtp(
    applicationId: string,
    invoiceId: string,
    userId: string,
    signatoryEmail: string
  ) {
    await this.assertInvoiceOfferAcceptAllowed(applicationId, invoiceId, userId);
    const loaded = await this.loadInvoiceOfferAcceptSignatories({ applicationId, invoiceId });
    const signatory = matchOfferAcceptSignatory(loaded.signatories, signatoryEmail);
    const offer = (loaded.invoice.offer_details as Record<string, unknown> | null) ?? {};
    const details = (loaded.invoice.details as Record<string, unknown> | null) ?? {};
    const invoiceNumber =
      details.number != null && String(details.number).trim() !== ""
        ? String(details.number).trim()
        : null;
    const invoiceReference =
      loaded.invoice.display_reference?.trim() || invoiceNumber || "invoice offer";
    const facilityReference = loaded.contract.display_reference?.trim() || "facility";
    const offeredAmount = Number(offer.offered_amount);
    return persistAndSendOfferAcceptOtp({
      applicationId,
      invoiceId,
      contractId: loaded.invoice.contract_id,
      requestedByUserId: userId,
      signatory,
      invoiceReference,
      facilityReference,
      offeredAmount: Number.isFinite(offeredAmount) ? offeredAmount : null,
    });
  }

  async respondToInvoiceOffer(
    applicationId: string,
    invoiceId: string,
    action: "accept" | "reject",
    userId: string | null,
    rejectionReason?: string,
    options?: {
      signingCompletion?: { signedOfferLetterS3Key: string; signedFileSha256: string };
      otp?: { challengeId: string; otpCode: string };
      consent_ids?: string[];
      logContext?: IssuerActivityLogContext;
    }
  ): Promise<Application> {
    if (userId) {
      await this.verifyApplicationAccess(applicationId, userId);
    } else if (!options?.signingCompletion) {
      throw new AppError(401, "UNAUTHORIZED", "Actor required to respond to this offer.");
    }

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const invoices =
      (application as { invoices?: { id: string; contract_id?: string | null }[] }).invoices ?? [];
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found in this application");
    }
    const occupancyContractId = resolveInvoiceOccupancyContractId({
      invoiceContractId: invoice.contract_id,
      application,
    });
    await this.assertPhasedOfferDirectAcceptBlocked({
      application,
      action,
      signingCompletion: options?.signingCompletion,
      invoiceId,
    });

    const scopeKey = await this.resolveInvoiceReviewItemKeyById(
      applicationId,
      application as { invoices?: { id: string; details?: { number?: string | number } }[] },
      invoiceId
    );
    const workflow = await this.getProductWorkflowForApplication(application);
    const isInvoiceOnlyPrimary = isInvoiceOnlyFinancingStructure(application.financing_structure);
    const respondInvoiceInTx = async (tx: Prisma.TransactionClient) => {
      const lockedInvoiceRows = await tx.$queryRaw<
        {
          status: string;
          offer_details: Prisma.JsonValue | null;
          contract_id: string | null;
        }[]
      >`SELECT status, offer_details, contract_id FROM invoices WHERE id = ${invoiceId} AND application_id = ${applicationId} FOR UPDATE`;

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

      if (action === "accept") {
        const acceptContractId = resolveInvoiceOccupancyContractId({
          invoiceContractId: dbInvoice.contract_id,
          application,
        });
        if (acceptContractId) {
          await lockContractRow(tx, acceptContractId);
          const contract = await tx.contract.findUnique({
            where: { id: acceptContractId },
            select: { contract_details: true },
          });
          assertFacilityFeeUpfrontSettled(contract?.contract_details);
          const schedule = parseInvoiceFeeSchedule(offer);
          await assertFacilityLinkedInvoiceAcceptFees(tx, {
            contractId: acceptContractId,
            currentInvoiceId: invoiceId,
            proposedCollectAmount: schedule?.facilityFeeCollectAmount ?? 0,
            contractDetails: contract?.contract_details,
          });
        }
      }

      assertAcceptanceDeadlineOpen(getOfferAcceptanceFromOfferDetails(offer));
      assertSigningDeadlineOpen(getOfferAcceptanceFromOfferDetails(offer));

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

      let acceptedSignatory: AcceptedOfferSignatory | undefined;
      let utilisationConsents:
        | ReturnType<typeof buildUtilisationOfferConsentAcknowledgement>
        | undefined;
      if (
        invoiceOfferAcceptRequiresOtp({
          action,
          invoiceContractId: dbInvoice.contract_id,
          signingCompletion: options?.signingCompletion,
        })
      ) {
        if (!options?.otp) {
          throw new AppError(
            400,
            "OTP_REQUIRED",
            "Enter the verification code sent to the authorised signatory."
          );
        }
        utilisationConsents = buildUtilisationOfferConsentAcknowledgement(options.consent_ids, now);
        if (!utilisationConsents) {
          throw new AppError(
            400,
            "CONSENTS_REQUIRED",
            "Tick both confirmations and confirm the full authorisation before accepting."
          );
        }
        acceptedSignatory = await consumeOfferAcceptOtpInTx(tx, {
          challengeId: options.otp.challengeId,
          otpCode: options.otp.otpCode,
          applicationId,
          invoiceId,
          contractId: dbInvoice.contract_id as string,
        });
        updatedOffer = {
          ...updatedOffer,
          accepted_signatory: acceptedSignatory,
          utilisation_consents: utilisationConsents,
        };
      }

      await tx.invoice.update({
        where: { id: invoiceId, application_id: applicationId },
        data: {
          status: newStatus,
          offer_details: updatedOffer as Prisma.InputJsonValue,
          ...(action === "reject" && { withdraw_reason: WithdrawReason.OFFER_REJECTED }),
        },
      });

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
      if (
        action === "accept" &&
        isInvoiceOnlyPrimary &&
        workflowShowsAcceptanceReviewSection(workflow)
      ) {
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
      const updatedContract =
        !isInvoiceOnlyPrimary && application.contract_id
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
      const isInvoiceOnly =
        (application as { financing_structure?: { structure_type?: string } }).financing_structure
          ?.structure_type === "invoice_only";
      const hasOfferAcceptance = !!getOfferAcceptanceFromOfferDetails(offer);
      const phasedAcceptStatus = resolveApplicationStatusAfterCommercialAccept({
        isInvoiceOnly,
        hasOfferAcceptance,
        action,
        isContractPath: false,
      });
      const nextReviewStatusBase =
        action === "accept" && phasedAcceptStatus
          ? phasedAcceptStatus
          : allInvoicesOfferedOrResolved
            ? ApplicationStatus.INVOICES_SENT
            : ApplicationStatus.INVOICE_PENDING;
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

      return {
        now,
        offeredAmount,
        requestedAmount,
        sectionApproved,
        appStatus,
        acceptedSignatory,
        utilisationConsents,
      };
    };
    const invoiceAcceptAudit =
      action === "accept"
        ? {
            userId,
            applicationId,
            portal: ActivityPortal.ISSUER,
            reason: "INVOICE_ACCEPTED" as const,
            invoiceId,
          }
        : undefined;
    let responseMeta: Awaited<ReturnType<typeof respondInvoiceInTx>>;
    try {
      responseMeta = occupancyContractId
        ? (
            await applyContractCapacityChange(occupancyContractId, prisma, respondInvoiceInTx, {
              assertWrite: true,
              audit: invoiceAcceptAudit,
            })
          ).result
        : await prisma.$transaction(respondInvoiceInTx);
    } catch (error) {
      if (isOfferAcceptOtpInvalidError(error) && options?.otp?.challengeId) {
        await incrementOfferAcceptOtpAttempts({
          challengeId: options.otp.challengeId,
          applicationId,
          invoiceId,
        });
      }
      throw error;
    }

    const invWithDetails = (
      application as { invoices?: { id: string; details?: { number?: string | number } }[] }
    ).invoices?.find((i) => i.id === invoiceId);
    const invoiceNumber =
      invWithDetails?.details?.number != null && String(invWithDetails.details.number).trim() !== ""
        ? String(invWithDetails.details.number).trim()
        : undefined;

    const eventType = action === "accept" ? "INVOICE_OFFER_ACCEPTED" : "INVOICE_OFFER_REJECTED";
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
        ...(responseMeta.acceptedSignatory
          ? { accepted_signatory: responseMeta.acceptedSignatory }
          : {}),
        ...(responseMeta.utilisationConsents
          ? { utilisation_consents: responseMeta.utilisationConsents }
          : {}),
      },
      ...(options?.logContext ?? {}),
    });
    if (responseMeta.appStatus === ApplicationStatus.WITHDRAWN) {
      try {
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.APPLICATION_WITHDRAWN_CONFIRMATION,
          { applicationId, withdrawalReason: "invoice_offer_declined", invoiceNumber },
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
        ...(options?.logContext ?? {}),
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
    this.assertFacilityOfferApplication(application);
    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no facility");
    }

    const contract = await prisma.contract.findUnique({
      where: { id: application.contract_id },
      select: { status: true, offer_details: true, display_reference: true },
    });
    if (!contract) {
      throw new AppError(404, "NOT_FOUND", "Facility not found");
    }
    const allowedStatuses = ["OFFER_SENT", "OFFER_EXPIRED", "APPROVED", "REJECTED"] as const;
    if (!allowedStatuses.includes(contract.status as (typeof allowedStatuses)[number])) {
      throw new AppError(400, "INVALID_STATE", "No facility offer to download");
    }

    const offer = contract.offer_details as Record<string, unknown> | null;
    if (!offer || typeof offer !== "object") {
      throw new AppError(400, "INVALID_STATE", "Facility has no offer details");
    }

    const acceptanceExpiresAt = getOfferAcceptanceFromOfferDetails(offer)?.acceptance_expires_at;
    const offerDetails: ContractOfferDetails = {
      requested_facility: parseFiniteNumber(offer.requested_facility),
      offered_facility: parseFiniteNumber(offer.offered_facility),
      facility_fee_rate_percent: parseFiniteNumber(offer.facility_fee_rate_percent) ?? 0,
      expires_at: typeof acceptanceExpiresAt === "string" ? acceptanceExpiresAt : undefined,
    };

    const cashSoukReference = contract.display_reference ?? null;
    const stream = generateContractOfferLetterStream(cashSoukReference, offerDetails);
    const filename = `contract-offer-${canonicalDownloadFilenameToken(cashSoukReference)}.pdf`;
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
      select: { status: true, offer_details: true, contract_id: true, display_reference: true },
    });
    if (!dbInvoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found");
    }
    const allowedStatuses = ["OFFER_SENT", "OFFER_EXPIRED", "APPROVED", "REJECTED"] as const;
    if (!allowedStatuses.includes(dbInvoice.status as (typeof allowedStatuses)[number])) {
      throw new AppError(400, "INVALID_STATE", "No invoice offer to download");
    }

    const offer = dbInvoice.offer_details as Record<string, unknown> | null;
    if (!offer || typeof offer !== "object") {
      throw new AppError(400, "INVALID_STATE", "Invoice has no offer details");
    }

    const schedule = parseInvoiceFeeSchedule(offer);
    let contractDetails: Record<string, unknown> | null = null;
    if (!schedule && dbInvoice.contract_id) {
      const contract = await prisma.contract.findUnique({
        where: { id: dbInvoice.contract_id },
        select: { contract_details: true },
      });
      contractDetails = (contract?.contract_details as Record<string, unknown> | null) ?? null;
    }

    const acceptanceExpiresAt = getOfferAcceptanceFromOfferDetails(offer)?.acceptance_expires_at;
    const offerDetails = {
      ...buildInvoiceOfferLetterDto(offer, contractDetails),
      expires_at: typeof acceptanceExpiresAt === "string" ? acceptanceExpiresAt : undefined,
    };

    const stream = generateInvoiceOfferLetterStream(
      dbInvoice.display_reference,
      offerDetails,
      invoiceOfferLetterKindForContract(dbInvoice.contract_id)
    );
    const filename = `invoice-offer-${canonicalDownloadFilenameToken(dbInvoice.display_reference)}.pdf`;
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
        documents: { orderBy: { order: "asc" } },
      },
      orderBy: { completed_at: "desc" },
    });

    const signedDocument = pickPrimarySignedOfferDocument(envelope?.documents ?? []);
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
    initiatedByUserId: string | null;
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
      if (e instanceof AppError && (e.code === "ALREADY_RESPONDED" || e.code === "INVALID_STATE")) {
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
      throw new AppError(400, "INVALID_STATE", "Application has no facility");
    }
    this.assertFacilityOfferApplication(application);

    const key = await this.resolveSignedOfferLetterS3KeyFromEnvelope({
      applicationId,
      contractId: application.contract_id,
    });
    const contract = await prisma.contract.findUnique({
      where: { id: application.contract_id },
      select: { display_reference: true },
    });
    const buffer = await getS3ObjectBuffer(key);
    return {
      buffer,
      filename: `signed-contract-offer-${canonicalDownloadFilenameToken(contract?.display_reference)}.pdf`,
    };
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
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, application_id: applicationId },
      select: { display_reference: true },
    });
    const buffer = await getS3ObjectBuffer(key);
    return {
      buffer,
      filename: `signed-invoice-offer-${canonicalDownloadFilenameToken(invoice?.display_reference)}.pdf`,
    };
  }

  /**
   * On-demand issuer application summary PDF. Not stored; not an offer letter.
   */
  async getApplicationSummaryPdf(
    applicationId: string,
    userId: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    await this.verifyApplicationAccess(applicationId, userId);

    const application = await this.repository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const logs = await this.getApplicationLogs(applicationId, userId);
    const remarks =
      (
        application as {
          application_review_remarks?: Array<{ author_user_id?: string | null }>;
        }
      ).application_review_remarks ?? [];
    const authorNames = await loadUserDisplayNameMap(
      prisma,
      remarks.map((row) => row.author_user_id)
    );

    const model = composeApplicationSummary({
      application: application as ComposeApplicationSummaryInput["application"],
      logs,
      authorNames,
      generatedAt: new Date(),
    });
    const html = buildApplicationSummaryHtml(model);
    const buffer = await renderApplicationSummaryHtmlToPdfBuffer(html);
    return { buffer, filename: model.filename };
  }

  /**
   * Admin year-level fallback for missing historical financial statement FYs.
   * Stored at `application.financial_statements.admin_input_by_year[fy]`.
   *
   * Eligibility and precedence are enforced via `getEligibleAdminInputYears`:
   * - FY must be inside the existing issuer/Admin tab window (12-month + 6-month logic).
   * - FY must not already have CTOS actual data.
   * - FY must not already have issuer stored unaudited actual data.
   */
  private async assertAdminFinancialEditsOpen(applicationId: string, status: string): Promise<void> {
    const reviewable = new Set([
      "SUBMITTED",
      "UNDER_REVIEW",
      "CONTRACT_PENDING",
      "CONTRACT_SENT",
      "CONTRACT_ACCEPTED",
      "INVOICE_ACCEPTED",
      "SIGNING_PENDING",
      "INVOICE_PENDING",
      "INVOICES_SENT",
      "OFFER_EXPIRED",
      "RESUBMITTED",
      "AMENDMENT_REQUESTED",
    ]);
    if (!reviewable.has(status)) {
      throw new AppError(400, "APPLICATION_NOT_REVIEWABLE", "Application is not in a reviewable state");
    }
    const review = await prisma.noteProspectusReview.findFirst({
      where: {
        note: { source_application_id: applicationId },
        approved_at: { not: null },
      },
      select: { approved_snapshot: true },
    });
    if (review?.approved_snapshot != null) {
      throw new AppError(
        409,
        "FINANCIAL_SNAPSHOT_LOCKED",
        "Approved prospectus financials are locked for this application"
      );
    }
  }

  async upsertAdminFinancialStatementFallbackYear(params: {
    applicationId: string;
    userId: string;
    financialYear: number;
    statementType: "AUDITED" | "NOT_AUDITED" | "MANAGEMENT_ACCOUNTS";
    /** Raw canonical financial statement block fields (without `pldd`; it is computed server-side). */
    rawFinancialInputs: Record<string, unknown>;
  }): Promise<{ updated: boolean; financialYear: number }> {
    const { applicationId, userId, financialYear, statementType, rawFinancialInputs } = params;
    if (statementType === "MANAGEMENT_ACCOUNTS") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Management accounts is no longer a statement type for new Admin financial statements"
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        issuer_organization_id: true,
        financial_statements: true,
      },
    });

    if (!application) throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    await this.assertAdminFinancialEditsOpen(applicationId, application.status);
    if (!application.issuer_organization_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no issuer organization");
    }
    if (!application.financial_statements || typeof application.financial_statements !== "object") {
      throw new AppError(
        400,
        "INVALID_STATE",
        "Application has no financial_statements to attach Admin fallbacks"
      );
    }

    const now = new Date();
    const ctosReport = await prisma.ctosReport.findFirst({
      where: { issuer_organization_id: application.issuer_organization_id, subject_ref: null },
      orderBy: { fetched_at: "desc" },
      select: { financials_json: true },
    });

    let eligibleYears = getEligibleAdminInputYears({
      financialStatements: application.financial_statements,
      ctosFinancials: ctosReport?.financials_json ?? null,
      ref: now,
    });

    // When CTOS was fetched successfully but returned zero financial-year records,
    // allow adding Admin Input fallbacks for the whole 3-year historical window
    // anchored to the latest stored issuer/Admin actual year.
    if (ctosReport && Array.isArray(ctosReport.financials_json) && ctosReport.financials_json.length === 0) {
      const fsRoot = application.financial_statements as any;
      const unauditedByYear = fsRoot?.unaudited_by_year;
      let maxStoredIssuerYearWithActualData: number | null = null;
      if (unauditedByYear && typeof unauditedByYear === "object" && !Array.isArray(unauditedByYear)) {
        for (const [key, storedIssuer] of Object.entries(unauditedByYear as Record<string, unknown>)) {
          const y = Number(key);
          if (!Number.isInteger(y)) continue;
          if (!storedIssuer || typeof storedIssuer !== "object" || Array.isArray(storedIssuer)) continue;
          if (!financialYearBlockHasActualData(storedIssuer as Record<string, unknown>)) continue;
          if (maxStoredIssuerYearWithActualData == null || y > maxStoredIssuerYearWithActualData) {
            maxStoredIssuerYearWithActualData = y;
          }
        }
      }

      if (maxStoredIssuerYearWithActualData != null) {
        eligibleYears = [maxStoredIssuerYearWithActualData - 3, maxStoredIssuerYearWithActualData - 2, maxStoredIssuerYearWithActualData - 1]
          .filter((y) => Number.isInteger(y))
          .filter((y) => {
            const storedIssuer = unauditedByYear?.[String(y)];
            return !(storedIssuer && financialYearBlockHasActualData(storedIssuer as Record<string, unknown>));
          });
      }
    }

    if (!eligibleYears.includes(financialYear)) {
      throw new AppError(
        400,
        "ADMIN_FINANCIAL_STATEMENT_NOT_ELIGIBLE",
        `FY${financialYear} is not eligible for Admin fallback`
      );
    }

    const questionnaire = (application.financial_statements as any)?.questionnaire;
    const financialYearEndIsoRaw = questionnaire?.financial_year_end;
    if (typeof financialYearEndIsoRaw !== "string") {
      throw new AppError(400, "INVALID_STATE", "Missing financial_statements.questionnaire");
    }

    const expectedPldd = issuerUnauditedPlddForFyEndYear(financialYear, {
      financial_year_end: financialYearEndIsoRaw,
    });

    const block = { ...rawFinancialInputs, pldd: expectedPldd };
    const parsed = financialStatementsInputSchema.safeParse(block);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join("; ");
      throw new AppError(400, "VALIDATION_ERROR", `FY${financialYear}: ${message}`);
    }

    if (parsed.data.pldd !== expectedPldd) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `FY${financialYear}: pldd must equal FY end date for that column`
      );
    }

    validateFinancialYearBlockOrThrow(parsed.data as any);
    const normalized = normalizeFinancialYearBlock(parsed.data as Record<string, unknown>);

    const key = String(financialYear);
    const existingFS = application.financial_statements as Prisma.InputJsonValue;
    const existingAdmin = (existingFS as any)?.admin_input_by_year;
    const previousBlock =
      existingAdmin && typeof existingAdmin === "object" && !Array.isArray(existingAdmin)
        ? (existingAdmin as any)[key]
        : undefined;
    const previousValues: Record<string, unknown> = {};
    if (previousBlock && typeof previousBlock === "object" && !Array.isArray(previousBlock)) {
      for (const [rawKey, v] of Object.entries(previousBlock as Record<string, unknown>)) {
        const label = FINANCIAL_FIELD_LABELS[rawKey];
        if (label) previousValues[label] = v;
      }
    }

    const nextAdmin = {
      ...(existingAdmin && typeof existingAdmin === "object" ? existingAdmin : {}),
      [key]: {
        ...(normalized as any),
        statementType,
        updated_by_user_id: userId,
        updated_at: now.toISOString(),
      },
    };
    const nextValues: Record<string, unknown> = {};
    for (const [rawKey, v] of Object.entries(normalized as Record<string, unknown>)) {
      const label = FINANCIAL_FIELD_LABELS[rawKey];
      if (label) nextValues[label] = v;
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: {
          financial_statements: {
            ...(existingFS as any),
            admin_input_by_year: nextAdmin,
          } as Prisma.InputJsonValue,
        },
      });
      await logApplicationActivity(
        {
          userId,
          applicationId,
          eventType: ApplicationLogEventType.FINANCIAL_YEAR_ADDED,
          portal: ActivityPortal.ADMIN,
          metadata: {
            applicationId,
            financialYear,
            fieldKey: null,
            originalSource: null,
            previousValue: null,
            newValue: null,
            action: "add_missing_fy",
            statementType,
            // Used by admin audit diff UI.
            previousValues,
            nextValues,
          },
        },
        tx
      );
    });

    await mergeApplicationAdminFinancialSupplementsIntoOrg({ applicationId });

    return { updated: true, financialYear };
  }

  async upsertAdminFinancialField(params: {
    applicationId: string;
    userId: string;
    financialYear: number;
    fieldKey: string;
    value: number;
    remark?: string;
  }): Promise<{ updated: boolean; financialYear: number; fieldKey: string }> {
    const { applicationId, userId, financialYear, fieldKey, value, remark } = params;
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        issuer_organization_id: true,
        financial_statements: true,
      },
    });
    if (!application) throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    if (!application.issuer_organization_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no issuer organization");
    }
    if (!application.financial_statements || typeof application.financial_statements !== "object") {
      throw new AppError(400, "INVALID_STATE", "Application has no financial_statements");
    }
    await this.assertAdminFinancialEditsOpen(applicationId, application.status);

    const now = new Date();
    const ctosReport = await prisma.ctosReport.findFirst({
      where: { issuer_organization_id: application.issuer_organization_id, subject_ref: null },
      orderBy: { fetched_at: "desc" },
      select: { financials_json: true },
    });

    const rawCtosFinancials = ctosReport?.financials_json as unknown;
    const ctosFetchState: "not_pulled" | "no_records" | "has_data" = !ctosReport
      ? "not_pulled"
      : Array.isArray(rawCtosFinancials)
        ? rawCtosFinancials.length === 0
          ? "no_records"
          : "has_data"
        : "has_data";

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: application.financial_statements,
      ctosFinancials: ctosReport?.financials_json ?? null,
      ref: now,
      ctosFetchState,
    });
    const decision = decideAdminFinancialFieldEdit({ columns, financialYear, fieldKey });
    if (!decision.ok) {
      throw new AppError(400, decision.code, decision.message);
    }
    if (!Number.isFinite(value)) {
      throw new AppError(400, "VALIDATION_ERROR", "Enter a numeric value");
    }

    const existingFS = application.financial_statements as Record<string, unknown>;
    const yearKey = String(financialYear);
    let nextFS: Record<string, unknown> = { ...existingFS };

    if (decision.action === "edit_admin_input") {
      const adminByYear =
        existingFS.admin_input_by_year &&
        typeof existingFS.admin_input_by_year === "object" &&
        !Array.isArray(existingFS.admin_input_by_year)
          ? { ...(existingFS.admin_input_by_year as Record<string, unknown>) }
          : {};
      const yearBlock =
        adminByYear[yearKey] && typeof adminByYear[yearKey] === "object"
          ? { ...(adminByYear[yearKey] as Record<string, unknown>) }
          : {};
      yearBlock[fieldKey] = value;
      yearBlock.updated_by_user_id = userId;
      yearBlock.updated_at = now.toISOString();
      adminByYear[yearKey] = yearBlock;
      nextFS = { ...existingFS, admin_input_by_year: adminByYear };
    } else {
      const overrides = parseAdminFieldOverrides(existingFS);
      const yearOverrides = { ...(overrides[yearKey] ?? {}) };
      yearOverrides[fieldKey] = {
        value,
        baseSource: decision.baseSource,
        action: decision.action,
        updated_by_user_id: userId,
        updated_at: now.toISOString(),
      };
      nextFS = { ...existingFS, admin_field_overrides: { ...overrides, [yearKey]: yearOverrides } };
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: { financial_statements: nextFS as Prisma.InputJsonValue },
      });
      await logApplicationActivity(
        {
          userId,
          applicationId,
          eventType: ApplicationLogEventType.FINANCIAL_FIELD_UPDATED,
          portal: ActivityPortal.ADMIN,
          remark,
          metadata: {
            applicationId,
            financialYear,
            fieldKey,
            fieldLabel: FINANCIAL_FIELD_LABELS[fieldKey] ?? fieldKey,
            originalSource: decision.originalSource,
            action: decision.action,
            previousValue: decision.previousValue,
            newValue: value,
            // These are used by the admin timeline diff UI.
            previousValues: {
              [FINANCIAL_FIELD_LABELS[fieldKey] ?? fieldKey]: decision.previousValue,
            },
            nextValues: {
              [FINANCIAL_FIELD_LABELS[fieldKey] ?? fieldKey]: value,
            },
          },
        },
        tx
      );
    });

    await mergeApplicationAdminFinancialSupplementsIntoOrg({ applicationId });
    return { updated: true, financialYear, fieldKey };
  }
}

export const applicationService = new ApplicationService();
