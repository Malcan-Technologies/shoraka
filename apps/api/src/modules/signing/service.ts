/**
 * Signing envelope service: draft envelope from product template + issuer bindings,
 * send to all signers via email, external token session, and provider orchestration.
 */
import {
  SIGNING_TEMPLATE_WORKFLOW_KEY,
  SIGNING_PACKAGES_WORKFLOW_KEY,
  getStepKeyFromStepId,
  parseSigningTemplateConfig,
  parseSigningPackagesConfig,
  resolveSigningTemplateForOffer,
  validateSigningTemplateConfig,
  isValidSigningIcNumber,
  normalizeSigningIcNumber,
  roleRequiresBindingIcAtOffer,
  validateRecipientBindings,
  buildEnvelopePlanFromTemplate,
  rollupDocumentStatus,
  rollupRecipientStatus,
  rollupEnvelopeStatus,
  normalizeSigningEmail,
  GUARANTOR_AGREEMENT_TEMPLATE_KEY,
  type AssignmentStatusInput,
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  getOfferAcceptanceFromOfferDetails,
  offerAcceptanceAllowsCreateSigningPackage,
  offerAcceptanceAllowsSendSigningPackage,
  collectAcceptanceDocumentReviewKeys,
  workflowUsesOfferAcceptanceFlow,
  type ExternalSigningSessionDto,
  type RecipientBinding,
  type RecipientEkycSession,
  type RecipientEkycSessionStatus,
  type SigningEnvelopeDto,
  type SigningPackageOfferKind,
  type SigningTemplateConfig,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { assertSigningDeadlineOpen } from "../../lib/phase-deadlines";
import { logger } from "../../lib/logger";
import { sendEmail } from "../../lib/email/ses-client";
import { getS3ObjectBuffer, putS3ObjectBuffer } from "../../lib/s3/client";
import { ProductRepository } from "../products/repository";
import { OrganizationRepository } from "../organization/repository";
import { patchOfferAcceptance } from "../applications/offer-acceptance";
import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { OrganizationService } from "../organization/service";
import { buildAdminPeopleList } from "../admin/build-people-list";
import { assertRequiredAcceptanceDocumentsPresent } from "../applications/supporting-docs-workflow";
import {
  generateContractOfferLetterBuffer,
  generateGuarantorAgreementPlaceholderBuffer,
  generateInvoiceOfferLetterBuffer,
  type OfferLetterSignatory,
} from "../applications/offer-letter-pdf";
import { applicationService } from "../applications/service";
import { logApplicationActivity } from "../applications/logs/service";
import { ActivityPortal, ApplicationLogEventType } from "../applications/logs/types";
import {
  signingRepository,
  type SigningApplicationContext,
  type SigningRepository,
} from "./repository";
import { mapSigningEnvelopeToDto, mapSigningEnvelopeToDtoWithEkyc, type SigningEnvelopeWithGraph } from "./mapper";
import { SigningCloudProvider } from "./provider/signingcloud-adapter";
import type { SigningProvider } from "./provider/adapter";
import {
  ekycService,
  resolveSigningKycStatus,
  assertProvidedIcCompatibleWithEmailEkyc,
} from "../ekyc/service";
import { generateSigningAccessToken } from "./token";
import { buildSigningReturnUrl, validateSigningRedirectUrl } from "../../lib/signing/redirect-url";

const EXTERNAL_ACCESS_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Trust-return from SigningCloud backUrl is only valid shortly after start-signing. */
const TRUST_RETURN_SESSION_MAX_MS = 2 * 60 * 60 * 1000;
const CLOSED_ENVELOPE_STATUSES = ["VOIDED", "DECLINED", "EXPIRED", "COMPLETED"] as const;

type RecipientSigningSessionMeta = {
  documentId: string;
  startedAt: string;
  returnSessionId: string;
};

function readRecipientSigningSession(metadata: unknown): RecipientSigningSessionMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const session = (metadata as Record<string, unknown>).last_signing_session;
  if (!session || typeof session !== "object") return null;
  const documentId = (session as Record<string, unknown>).documentId;
  const startedAt = (session as Record<string, unknown>).startedAt;
  const returnSessionId = (session as Record<string, unknown>).returnSessionId;
  if (typeof documentId !== "string" || !documentId.trim()) return null;
  if (typeof startedAt !== "string" || !startedAt.trim()) return null;
  if (typeof returnSessionId !== "string" || !returnSessionId.trim()) return null;
  return {
    documentId: documentId.trim(),
    startedAt: startedAt.trim(),
    returnSessionId: returnSessionId.trim(),
  };
}

function mergeRecipientSigningSession(
  metadata: unknown,
  session: RecipientSigningSessionMeta
): Prisma.InputJsonValue {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  return {
    ...base,
    last_signing_session: session,
  } as Prisma.InputJsonValue;
}

function buildExternalSigningUrl(accessToken: string): string | null {
  const issuerUrl = process.env.ISSUER_URL?.trim().replace(/\/$/, "");
  if (!issuerUrl) return null;
  return `${issuerUrl}/signing/external/${encodeURIComponent(accessToken)}`;
}

/** Public webhook URL SigningCloud calls after a signature completes (`callUrl`). */
function buildSigningCloudCallbackUrl(): string | null {
  // Prefer API_PUBLIC_URL (tunnel/prod); API_URL kept as fallback for older envs.
  const apiUrl = (process.env.API_PUBLIC_URL || process.env.API_URL)?.trim().replace(/\/$/, "");
  if (!apiUrl) return null;
  return `${apiUrl}/v1/webhooks/signingcloud/callback`;
}

function isClosedEnvelopeStatus(status: string): boolean {
  return (CLOSED_ENVELOPE_STATUSES as readonly string[]).includes(status);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unwrapSupportingDocumentCategories(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  let raw = data as Record<string, unknown>;
  if (raw.supporting_documents && typeof raw.supporting_documents === "object") {
    raw = raw.supporting_documents as Record<string, unknown>;
  }
  const categories = raw.categories;
  return Array.isArray(categories) ? categories : [];
}

function readUploadedS3Key(doc: unknown): string | null {
  if (!doc || typeof doc !== "object") return null;
  const o = doc as Record<string, unknown>;
  const file = o.file as Record<string, unknown> | undefined;
  if (typeof file?.s3_key === "string" && file.s3_key.length > 0) return file.s3_key;
  const files = o.files;
  if (Array.isArray(files)) {
    for (const f of files) {
      if (
        f &&
        typeof f === "object" &&
        typeof (f as Record<string, unknown>).s3_key === "string" &&
        String((f as Record<string, unknown>).s3_key).length > 0
      ) {
        return String((f as Record<string, unknown>).s3_key);
      }
    }
  }
  return null;
}

function findApplicationCategoryByKey(
  appCategories: unknown[],
  categoryKey: string
): Record<string, unknown> | undefined {
  for (const cat of appCategories) {
    if (!cat || typeof cat !== "object") continue;
    const key =
      typeof (cat as Record<string, unknown>).key === "string"
        ? String((cat as Record<string, unknown>).key)
        : typeof (cat as Record<string, unknown>).category_key === "string"
          ? String((cat as Record<string, unknown>).category_key)
          : null;
    if (key === categoryKey) return cat as Record<string, unknown>;
  }
  return undefined;
}

function resolveIssuerUploadS3Keys(
  workflow: unknown[],
  applicationSupportingDocuments: unknown,
  template: SigningTemplateConfig
): Map<string, string> {
  const keys = new Map<string, string>();
  const refs = template.supporting_docs ?? [];
  if (refs.length === 0) return keys;

  let config: Record<string, unknown> | null = null;
  for (const step of workflow) {
    const sid = (step as { id?: string })?.id ?? "";
    if (getStepKeyFromStepId(sid) !== "supporting_documents") continue;
    const c = (step as { config?: Record<string, unknown> }).config;
    if (c && typeof c === "object") config = c;
    break;
  }
  if (!config) return keys;

  const appCategories = unwrapSupportingDocumentCategories(applicationSupportingDocuments);

  for (const ref of refs) {
    const [categoryKey, docIndexRaw] = ref.step_key.split(":");
    const docIndex = Number.parseInt(docIndexRaw ?? "", 10);
    if (!categoryKey || Number.isNaN(docIndex)) continue;
    if (!(categoryKey in config) || !Array.isArray(config[categoryKey])) continue;
    const appCat = findApplicationCategoryByKey(appCategories, categoryKey);
    const appDocs = appCat?.documents;
    const appDoc = Array.isArray(appDocs) ? appDocs[docIndex] : undefined;
    const s3Key = readUploadedS3Key(appDoc);
    if (s3Key) keys.set(ref.step_key, s3Key);
  }
  return keys;
}

export interface CreateDraftEnvelopeInput {
  applicationId: string;
  templateConfig: unknown;
  bindings: RecipientBinding[];
  title: string;
  contractId?: string | null;
  invoiceId?: string | null;
  productVersion?: number | null;
  createdByUserId?: string | null;
  expiresAt?: Date | null;
  issuerUploadS3Keys?: Map<string, string>;
}

export interface CreateIssuerEnvelopeInput {
  applicationId: string;
  userId: string;
  bindings: RecipientBinding[];
  title?: string | null;
  contractId?: string | null;
  invoiceId?: string | null;
  expiresAt?: Date | null;
}

export class SigningService {
  constructor(
    private readonly repo: SigningRepository = signingRepository,
    private readonly provider: SigningProvider = new SigningCloudProvider(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly organizationRepository: OrganizationRepository = new OrganizationRepository(),
    private readonly organizationService: OrganizationService = new OrganizationService()
  ) {}

  private async requireApplicationContext(
    applicationId: string
  ): Promise<SigningApplicationContext> {
    const application = await this.repo.findApplicationContext(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found.");
    }
    return application;
  }

  private async assertIssuerApplicationAccess(
    application: SigningApplicationContext,
    userId: string
  ): Promise<void> {
    const organization = application.issuer_organization;
    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found for this application.");
    }
    if (organization.owner_user_id === userId) return;
    const member = await this.organizationRepository.getOrganizationMember(
      application.issuer_organization_id,
      userId,
      "issuer"
    );
    if (!member) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this application.");
    }
  }

  private readSigningTemplateFromWorkflow(
    workflow: unknown,
    kind: SigningPackageOfferKind
  ): SigningTemplateConfig {
    const steps = Array.isArray(workflow) ? workflow : [];
    for (const step of steps) {
      const config = (step as { config?: Record<string, unknown> } | null)?.config;
      if (!config) continue;
      if (
        config[SIGNING_PACKAGES_WORKFLOW_KEY] != null ||
        config[SIGNING_TEMPLATE_WORKFLOW_KEY] != null
      ) {
        const packages = parseSigningPackagesConfig(config);
        return resolveSigningTemplateForOffer({ packages, kind });
      }
    }
    return resolveSigningTemplateForOffer({
      packages: parseSigningPackagesConfig(null),
      kind,
    });
  }

  /**
   * Frozen product workflow for this application: base_id family + application.product_version.
   * Never falls forward to a newer live product row.
   */
  private async getProductWorkflowForApplication(
    application: SigningApplicationContext
  ): Promise<unknown[]> {
    const productId = (application.financing_type as { product_id?: string } | null | undefined)
      ?.product_id;
    if (!productId) {
      throw new AppError(400, "VALIDATION_ERROR", "Application has no product configured.");
    }
    const version = application.product_version;
    if (typeof version !== "number" || !Number.isFinite(version)) {
      throw new AppError(
        400,
        "PRODUCT_VERSION_NOT_FOUND",
        "Application has no frozen product version for signing."
      );
    }
    const product = await this.productRepository.findByBaseAndVersion(productId, version);
    if (!product) {
      throw new AppError(
        404,
        "PRODUCT_VERSION_NOT_FOUND",
        `Product version ${version} was not found for this application.`
      );
    }
    return (product.workflow as unknown[]) ?? [];
  }

  /** Issuer configure-signers UI: same frozen workflow used when creating the envelope. */
  async getProductWorkflowForIssuerApplication(
    applicationId: string,
    userId: string
  ): Promise<{ product_version: number; workflow: unknown[] }> {
    const application = await this.requireApplicationContext(applicationId);
    await this.assertIssuerApplicationAccess(application, userId);
    const workflow = await this.getProductWorkflowForApplication(application);
    return { product_version: application.product_version, workflow };
  }

  private applicationHasOfferSent(application: SigningApplicationContext): boolean {
    const status = application.status as string;
    if (
      status === ApplicationStatus.CONTRACT_SENT ||
      status === ApplicationStatus.INVOICES_SENT ||
      status === ApplicationStatus.CONTRACT_ACCEPTED ||
      status === ApplicationStatus.INVOICE_ACCEPTED ||
      status === ApplicationStatus.SIGNING_PENDING ||
      status === ApplicationStatus.CONTRACT_SIGNED ||
      status === ApplicationStatus.INVOICE_SIGNED ||
      status === ApplicationStatus.APPROVED
    ) {
      return true;
    }
    if (application.contract?.status === ContractStatus.OFFER_SENT) return true;
    return application.invoices.some((invoice) => invoice.status === InvoiceStatus.OFFER_SENT);
  }

  private resolveEnvelopeTarget(input: {
    application: SigningApplicationContext;
    contractId?: string | null;
    invoiceId?: string | null;
  }): { contractId: string | null; invoiceId: string | null } {
    const { application, contractId, invoiceId } = input;
    if (contractId && invoiceId) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose either a contract or invoice offer, not both.");
    }
    if (contractId) {
      if (application.contract_id !== contractId || application.contract?.status !== ContractStatus.OFFER_SENT) {
        throw new AppError(400, "INVALID_STATE", "Contract offer is not available for signing.");
      }
      return { contractId, invoiceId: null };
    }
    if (invoiceId) {
      const invoice = application.invoices.find((item) => item.id === invoiceId);
      if (!invoice || invoice.status !== InvoiceStatus.OFFER_SENT) {
        throw new AppError(400, "INVALID_STATE", "Invoice offer is not available for signing.");
      }
      return { contractId: null, invoiceId };
    }
    if (application.contract?.status === ContractStatus.OFFER_SENT) {
      return { contractId: application.contract.id, invoiceId: null };
    }
    const invoice = application.invoices.find((item) => item.status === InvoiceStatus.OFFER_SENT);
    if (invoice) return { contractId: null, invoiceId: invoice.id };
    throw new AppError(400, "INVALID_STATE", "No pending offer is available for signing.");
  }

  private async validateAndNormalizeIssuerBindings(
    application: SigningApplicationContext,
    template: SigningTemplateConfig,
    bindings: RecipientBinding[]
  ): Promise<RecipientBinding[]> {
    const extras = await this.organizationService.getIssuerPartyListExtras(
      application.issuer_organization_id
    );
    const people = buildAdminPeopleList({
      ctos: extras.latestOrganizationCtosCompanyJson ?? null,
      issuerDirectorKycStatus: application.issuer_organization.director_kyc_status ?? null,
      issuerDirectorAmlStatus: application.issuer_organization.director_aml_status ?? null,
      ctosPartySupplements: extras.ctosPartySupplements.map((row) => ({
        party_key: row.partyKey,
        onboarding_json: row.onboardingJson,
      })),
      corporateEntities: application.issuer_organization.corporate_entities ?? null,
    });
    const directorEmails = new Set(
      people
        .filter((person) => person.roles.some((role) => role.toUpperCase() === "DIRECTOR"))
        .map((person) => String(person.email ?? "").trim().toLowerCase())
        .filter(Boolean)
    );
    const roleByKey = new Map(template.roles.map((role) => [role.key, role]));
    const applicationGuarantorIds = new Set(application.application_guarantors.map((g) => g.id));
    const normalized: RecipientBinding[] = [];
    for (const binding of bindings) {
      const role = roleByKey.get(binding.role_key);
      if (!role) {
        normalized.push(binding);
        continue;
      }
      if (role.key === "issuer_director" || role.source_hint === "issuer_director") {
        const email = binding.email.trim().toLowerCase();
        if (!directorEmails.has(email)) {
          throw new AppError(
            400,
            "SIGNING_BINDINGS_INVALID",
            `Recipient for "${role.label || role.key}" must be one of the application's directors.`
          );
        }
      }
      if (
        binding.application_guarantor_id &&
        !applicationGuarantorIds.has(binding.application_guarantor_id)
      ) {
        throw new AppError(
          400,
          "SIGNING_BINDINGS_INVALID",
          "Selected guarantor does not belong to this application."
        );
      }
      if (roleRequiresBindingIcAtOffer(role)) {
        if (!String(binding.ic_number ?? "").trim()) {
          throw new AppError(
            400,
            "SIGNING_BINDINGS_INVALID",
            `Recipient for "${role.label || role.key}" must include an IC number.`
          );
        }
        if (!isValidSigningIcNumber(binding.ic_number)) {
          throw new AppError(
            400,
            "SIGNING_BINDINGS_INVALID",
            `Recipient for "${role.label || role.key}" must have a valid 12-digit IC number.`
          );
        }
        normalized.push({
          ...binding,
          application_guarantor_id: binding.application_guarantor_id ?? null,
          ic_number: normalizeSigningIcNumber(binding.ic_number!),
        });
        continue;
      }

      // Third-party roles (e.g. guarantor) always self-declare IC on the signing link.
      normalized.push({
        ...binding,
        application_guarantor_id: binding.application_guarantor_id ?? null,
        ic_number: null,
      });
    }
    return normalized;
  }

  private async assertAcceptanceDocumentsReady(
    application: SigningApplicationContext
  ): Promise<void> {
    const workflow = await this.getProductWorkflowForApplication(application);
    assertRequiredAcceptanceDocumentsPresent(
      workflow,
      (application as { acceptance_documents?: unknown }).acceptance_documents
    );
  }

  /** Review-item statuses for acceptance docs, keyed by review scope key. Missing rows are "not approved". */
  private async fetchAcceptanceReviewStatusByKey(
    applicationId: string,
    docKeys: string[]
  ): Promise<Map<string, string>> {
    if (docKeys.length === 0) return new Map();
    const rows = await prisma.applicationReviewItem.findMany({
      where: { application_id: applicationId, item_type: "document", item_id: { in: docKeys } },
      select: { item_id: true, status: true },
    });
    return new Map(rows.map((row) => [row.item_id, row.status as string]));
  }

  /** Acceptance-document review keys that are not (yet) APPROVED; empty means fully approved (or none required). */
  private async collectUnapprovedAcceptanceDocumentKeys(
    application: SigningApplicationContext,
    workflow: unknown[]
  ): Promise<string[]> {
    const docKeys = collectAcceptanceDocumentReviewKeys(
      workflow,
      application.acceptance_documents
    );
    if (docKeys.length === 0) return [];
    const statusByKey = await this.fetchAcceptanceReviewStatusByKey(application.id, docKeys);
    return docKeys.filter((key) => statusByKey.get(key) !== "APPROVED");
  }

  private async assertAcceptanceDocumentsApprovedForSigning(
    application: SigningApplicationContext,
    workflow: unknown[]
  ): Promise<void> {
    const unapproved = await this.collectUnapprovedAcceptanceDocumentKeys(application, workflow);
    if (unapproved.length > 0) {
      throw new AppError(
        400,
        "OFFER_ACCEPTANCE_DOCUMENTS_NOT_APPROVED",
        "All acceptance documents must be approved by CashSouk before the signing package can be created or sent.",
        { unapproved_keys: unapproved }
      );
    }
  }

  /**
   * When the product uses phased acceptance, envelope create/send requires a fresh,
   * well-formed offer_acceptance phase (no legacy allow) plus fully-approved acceptance docs.
   * Re-reads the offer from the DB rather than trusting the in-memory application context.
   */
  private async assertOfferAcceptanceAllowsSigning(
    application: SigningApplicationContext,
    contractId: string | null,
    invoiceId: string | null,
    action: "create" | "send"
  ): Promise<void> {
    const workflow = await this.getProductWorkflowForApplication(application);
    if (!workflowUsesOfferAcceptanceFlow(workflow)) return;

    let offerDetails: unknown = null;
    if (contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { offer_details: true },
      });
      offerDetails = contract?.offer_details ?? null;
    } else if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { offer_details: true },
      });
      offerDetails = invoice?.offer_details ?? null;
    } else {
      throw new AppError(400, "INVALID_STATE", "No offer target was provided for signing.");
    }

    const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
    if (!acceptance) {
      throw new AppError(
        400,
        "OFFER_ACCEPTANCE_MISSING",
        "This offer has no acceptance phase recorded and cannot be signed."
      );
    }

    const allowed =
      action === "create"
        ? offerAcceptanceAllowsCreateSigningPackage(acceptance.status)
        : offerAcceptanceAllowsSendSigningPackage(acceptance.status);
    if (!allowed) {
      throw new AppError(
        400,
        "OFFER_ACCEPTANCE_NOT_APPROVED",
        "Acceptance documents must be approved by CashSouk before the signing package can be created or sent."
      );
    }

    assertSigningDeadlineOpen(acceptance);

    await this.assertAcceptanceDocumentsApprovedForSigning(application, workflow);
  }

  private async logSigningPackageActivity(params: {
    userId: string;
    applicationId: string;
    eventType: ApplicationLogEventType;
    envelope: {
      id: string;
      contract_id?: string | null;
      invoice_id?: string | null;
      title?: string | null;
    };
    portal?: ActivityPortal;
    extraMetadata?: Record<string, unknown>;
  }): Promise<void> {
    await logApplicationActivity({
      userId: params.userId,
      applicationId: params.applicationId,
      entityId: params.envelope.id,
      portal: params.portal ?? ActivityPortal.ISSUER,
      eventType: params.eventType,
      metadata: {
        envelope_id: params.envelope.id,
        ...(params.envelope.contract_id ? { contract_id: params.envelope.contract_id } : {}),
        ...(params.envelope.invoice_id ? { invoice_id: params.envelope.invoice_id } : {}),
        ...(params.envelope.title?.trim() ? { envelope_title: params.envelope.title.trim() } : {}),
        ...params.extraMetadata,
      },
    });
  }

  /** Only APPROVED_FOR_SIGNING may advance to SIGNING_IN_PROGRESS; any other phase is a no-op. */
  private async markOfferAcceptanceSigningInProgress(
    envelope: SigningEnvelopeWithGraph
  ): Promise<void> {
    if (envelope.contract_id) {
      const contract = await prisma.contract.findUnique({
        where: { id: envelope.contract_id },
        select: { offer_details: true },
      });
      const offer = (contract?.offer_details as Record<string, unknown> | null) ?? null;
      if (!offer) return;
      const current = getOfferAcceptanceFromOfferDetails(offer);
      if (!current || current.status !== "APPROVED_FOR_SIGNING") return;
      await prisma.contract.update({
        where: { id: envelope.contract_id },
        data: {
          offer_details: patchOfferAcceptance(offer, {
            status: "SIGNING_IN_PROGRESS",
          }) as Prisma.InputJsonValue,
        },
      });
      return;
    }
    if (envelope.invoice_id) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: envelope.invoice_id },
        select: { offer_details: true },
      });
      const offer = (invoice?.offer_details as Record<string, unknown> | null) ?? null;
      if (!offer) return;
      const current = getOfferAcceptanceFromOfferDetails(offer);
      if (!current || current.status !== "APPROVED_FOR_SIGNING") return;
      await prisma.invoice.update({
        where: { id: envelope.invoice_id },
        data: {
          offer_details: patchOfferAcceptance(offer, {
            status: "SIGNING_IN_PROGRESS",
          }) as Prisma.InputJsonValue,
        },
      });
    }
  }

  /**
   * Roll offer_acceptance back from SIGNING_IN_PROGRESS after an envelope closes without
   * completing (void / decline). Only restores APPROVED_FOR_SIGNING when acceptance docs are
   * still fully approved; otherwise the phase is left untouched (no unsupported transition).
   */
  private async rollbackOfferAcceptanceAfterEnvelopeClosed(
    envelope: Pick<SigningEnvelopeWithGraph, "application_id" | "contract_id" | "invoice_id">
  ): Promise<void> {
    if (!envelope.contract_id && !envelope.invoice_id) return;

    let offer: Record<string, unknown> | null = null;
    if (envelope.contract_id) {
      const contract = await prisma.contract.findUnique({
        where: { id: envelope.contract_id },
        select: { offer_details: true },
      });
      offer = (contract?.offer_details as Record<string, unknown> | null) ?? null;
    } else if (envelope.invoice_id) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: envelope.invoice_id },
        select: { offer_details: true },
      });
      offer = (invoice?.offer_details as Record<string, unknown> | null) ?? null;
    }
    if (!offer) return;

    const current = getOfferAcceptanceFromOfferDetails(offer);
    if (!current || current.status !== "SIGNING_IN_PROGRESS") return;

    const application = await this.requireApplicationContext(envelope.application_id);
    const workflow = await this.getProductWorkflowForApplication(application);
    const unapproved = await this.collectUnapprovedAcceptanceDocumentKeys(application, workflow);
    if (unapproved.length > 0) return;

    const updatedOffer = patchOfferAcceptance(offer, {
      status: "APPROVED_FOR_SIGNING",
    }) as Prisma.InputJsonValue;
    if (envelope.contract_id) {
      await prisma.contract.update({
        where: { id: envelope.contract_id },
        data: { offer_details: updatedOffer },
      });
    } else if (envelope.invoice_id) {
      await prisma.invoice.update({
        where: { id: envelope.invoice_id },
        data: { offer_details: updatedOffer },
      });
    }
  }

  /** Idempotently mark offer_acceptance COMPLETED once the signing envelope is COMPLETED. */
  private async markOfferAcceptanceCompleted(
    envelope: Pick<SigningEnvelopeWithGraph, "contract_id" | "invoice_id">
  ): Promise<void> {
    if (envelope.contract_id) {
      const contract = await prisma.contract.findUnique({
        where: { id: envelope.contract_id },
        select: { offer_details: true },
      });
      const offer = (contract?.offer_details as Record<string, unknown> | null) ?? null;
      if (!offer) return;
      const current = getOfferAcceptanceFromOfferDetails(offer);
      if (!current || current.status === "COMPLETED") return;
      await prisma.contract.update({
        where: { id: envelope.contract_id },
        data: {
          offer_details: patchOfferAcceptance(offer, { status: "COMPLETED" }) as Prisma.InputJsonValue,
        },
      });
      return;
    }
    if (envelope.invoice_id) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: envelope.invoice_id },
        select: { offer_details: true },
      });
      const offer = (invoice?.offer_details as Record<string, unknown> | null) ?? null;
      if (!offer) return;
      const current = getOfferAcceptanceFromOfferDetails(offer);
      if (!current || current.status === "COMPLETED") return;
      await prisma.invoice.update({
        where: { id: envelope.invoice_id },
        data: {
          offer_details: patchOfferAcceptance(offer, { status: "COMPLETED" }) as Prisma.InputJsonValue,
        },
      });
    }
  }

  async createDraftEnvelope(input: CreateDraftEnvelopeInput): Promise<SigningEnvelopeDto> {
    const template = parseSigningTemplateConfig(input.templateConfig);

    const templateErrors = validateSigningTemplateConfig(template);
    if (templateErrors.length > 0) {
      throw new AppError(400, "SIGNING_TEMPLATE_INVALID", templateErrors[0], templateErrors);
    }

    const bindingErrors = validateRecipientBindings(template, input.bindings);
    if (bindingErrors.length > 0) {
      throw new AppError(400, "SIGNING_BINDINGS_INVALID", bindingErrors[0], bindingErrors);
    }

    const plan = buildEnvelopePlanFromTemplate(template, input.bindings, {
      issuerUploadS3Keys: input.issuerUploadS3Keys,
    });
    const envelope = await this.repo.createFromPlan({
      application_id: input.applicationId,
      contract_id: input.contractId ?? null,
      invoice_id: input.invoiceId ?? null,
      product_version: input.productVersion ?? null,
      title: input.title,
      created_by_user_id: input.createdByUserId ?? null,
      expires_at: input.expiresAt ?? null,
      plan,
    });
    return await mapSigningEnvelopeToDtoWithEkyc(envelope);
  }

  async createIssuerEnvelope(input: CreateIssuerEnvelopeInput): Promise<SigningEnvelopeDto> {
    const application = await this.requireApplicationContext(input.applicationId);
    await this.assertIssuerApplicationAccess(application, input.userId);
    if (!this.applicationHasOfferSent(application)) {
      throw new AppError(400, "INVALID_STATE", "An offer must be sent before creating a signing package.");
    }
    const { contractId, invoiceId } = this.resolveEnvelopeTarget({
      application,
      contractId: input.contractId,
      invoiceId: input.invoiceId,
    });
    if (invoiceId) {
      const invoice = application.invoices.find((item) => item.id === invoiceId);
      if (invoice?.contract_id) {
        throw new AppError(
          400,
          "CONTRACT_LINKED_INVOICE_NO_PACKAGE",
          "Contract-linked invoice offers do not use a signing package. Accept or decline the offer instead."
        );
      }
    }
    const activeEnvelope = contractId
      ? await this.repo.findActiveEnvelopeForContract(contractId)
      : invoiceId
        ? await this.repo.findActiveEnvelopeForInvoice(invoiceId)
        : null;
    if (activeEnvelope) {
      throw new AppError(
        409,
        "SIGNING_ENVELOPE_EXISTS",
        "This offer already has an active signing package."
      );
    }
    await this.assertAcceptanceDocumentsReady(application);
    await this.assertOfferAcceptanceAllowsSigning(application, contractId, invoiceId, "create");
    const workflow = await this.getProductWorkflowForApplication(application);
    const packageKind: SigningPackageOfferKind = contractId ? "contract" : "invoice";
    const template = this.readSigningTemplateFromWorkflow(workflow, packageKind);
    const bindings = await this.validateAndNormalizeIssuerBindings(
      application,
      template,
      input.bindings
    );
    const issuerUploadS3Keys = resolveIssuerUploadS3Keys(
      workflow,
      application.supporting_documents,
      template
    );
    const offerDetails = contractId
      ? (
          await prisma.contract.findUnique({
            where: { id: contractId },
            select: { offer_details: true },
          })
        )?.offer_details
      : invoiceId
        ? (
            await prisma.invoice.findUnique({
              where: { id: invoiceId },
              select: { offer_details: true },
            })
          )?.offer_details
        : null;
    const signingExpiresAt =
      getOfferAcceptanceFromOfferDetails(offerDetails)?.signing_expires_at ?? null;
    const resolvedExpiresAt =
      input.expiresAt ??
      (typeof signingExpiresAt === "string" ? new Date(signingExpiresAt) : null);
    return this.createDraftEnvelope({
      applicationId: input.applicationId,
      title: input.title?.trim() || "Signing package",
      contractId,
      invoiceId,
      productVersion: application.product_version ?? null,
      templateConfig: template,
      bindings,
      createdByUserId: input.userId,
      expiresAt: resolvedExpiresAt,
      issuerUploadS3Keys,
    }).then(async (envelope) => {
      await this.logSigningPackageActivity({
        userId: input.userId,
        applicationId: input.applicationId,
        eventType: ApplicationLogEventType.SIGNING_PACKAGE_CREATED,
        envelope,
      });
      return envelope;
    });
  }

  async getEnvelope(id: string): Promise<SigningEnvelopeDto> {
    return await mapSigningEnvelopeToDtoWithEkyc(await this.requireEnvelope(id));
  }

  async listEnvelopesForApplication(applicationId: string): Promise<SigningEnvelopeDto[]> {
    const envelopes = await this.repo.findByApplicationId(applicationId);
    return Promise.all(envelopes.map((envelope) => mapSigningEnvelopeToDtoWithEkyc(envelope)));
  }

  async getEnvelopeForIssuer(id: string, userId: string): Promise<SigningEnvelopeDto> {
    const envelope = await this.requireEnvelope(id);
    const application = await this.requireApplicationContext(envelope.application_id);
    await this.assertIssuerApplicationAccess(application, userId);
    return await mapSigningEnvelopeToDtoWithEkyc(envelope);
  }

  async listEnvelopesForApplicationForIssuer(
    applicationId: string,
    userId: string
  ): Promise<SigningEnvelopeDto[]> {
    const application = await this.requireApplicationContext(applicationId);
    await this.assertIssuerApplicationAccess(application, userId);
    return this.listEnvelopesForApplication(applicationId);
  }

  /**
   * Resolve a signed PDF for an envelope document after authz.
   * S3 keys stay server-side — clients pass documentId only.
   */
  async getSignedDocumentBuffer(input: {
    applicationId: string;
    documentId: string;
    /** Issuer caller — required when asAdmin is false. */
    userId?: string;
    asAdmin?: boolean;
  }): Promise<{ buffer: Buffer; filename: string }> {
    if (!input.asAdmin) {
      if (!input.userId) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }
      const application = await this.requireApplicationContext(input.applicationId);
      await this.assertIssuerApplicationAccess(application, input.userId);
    } else {
      await this.requireApplicationContext(input.applicationId);
    }

    const document = await prisma.signingDocument.findUnique({
      where: { id: input.documentId },
      select: {
        id: true,
        name: true,
        signed_s3_key: true,
        envelope: { select: { application_id: true } },
      },
    });
    if (!document || document.envelope.application_id !== input.applicationId) {
      throw new AppError(404, "SIGNING_DOCUMENT_NOT_FOUND", "Document not found.");
    }

    const key = document.signed_s3_key?.trim();
    if (!key) {
      throw new AppError(404, "SIGNED_DOCUMENT_NOT_FOUND", "Signed document is not available yet.");
    }
    const expectedPrefix = `applications/${input.applicationId}/`;
    if (!key.startsWith(expectedPrefix)) {
      logger.error(
        { applicationId: input.applicationId, documentId: input.documentId },
        "Signed document S3 key does not match application prefix"
      );
      throw new AppError(404, "SIGNED_DOCUMENT_NOT_FOUND", "Signed document is not available yet.");
    }

    const buffer = await getS3ObjectBuffer(key);
    const safeName = document.name.replace(/[^\w.\- ]+/g, "").trim() || "signed-document";
    return { buffer, filename: `${safeName}.pdf` };
  }

  private async resolveExternalTokenSession(accessToken: string): Promise<{
    envelope: SigningEnvelopeWithGraph;
    recipientId: string;
    recipient: SigningEnvelopeWithGraph["recipients"][number];
  }> {
    const resolved = await this.repo.findEnvelopeByRecipientAccessToken(accessToken);
    if (!resolved) {
      throw new AppError(404, "SIGNING_LINK_NOT_FOUND", "Signing link not found.");
    }
    const recipient = resolved.envelope.recipients.find((item) => item.id === resolved.recipientId);
    if (!recipient) {
      throw new AppError(403, "SIGNING_LINK_INVALID", "Signing link is not valid for this recipient.");
    }
    if (
      recipient.access_token_expires_at &&
      recipient.access_token_expires_at.getTime() < Date.now()
    ) {
      throw new AppError(410, "SIGNING_LINK_EXPIRED", "This signing link has expired.");
    }
    return { ...resolved, recipient };
  }

  private assertExternalEnvelopeOpen(envelope: SigningEnvelopeWithGraph): void {
    if (isClosedEnvelopeStatus(envelope.status)) {
      throw new AppError(409, "SIGNING_ENVELOPE_CLOSED", "This signing package is closed.");
    }
  }

  private async requireExternalTokenSession(accessToken: string): Promise<{
    envelope: SigningEnvelopeWithGraph;
    recipientId: string;
    recipient: SigningEnvelopeWithGraph["recipients"][number];
  }> {
    const resolved = await this.resolveExternalTokenSession(accessToken);
    this.assertExternalEnvelopeOpen(resolved.envelope);
    return resolved;
  }

  private async mapExternalSession(
    envelope: SigningEnvelopeWithGraph,
    recipient: SigningEnvelopeWithGraph["recipients"][number],
    packageClosed = false
  ): Promise<ExternalSigningSessionDto> {
    const kyc_status = await resolveSigningKycStatus({
      kycRequired: recipient.kyc_required,
      email: recipient.email,
      icNumber: recipient.ic_number,
    });

    const recipientDocumentIds = new Set(
      envelope.assignments
        .filter((assignment) => assignment.recipient_id === recipient.id)
        .map((assignment) => assignment.document_id)
    );

    const envelopeDto = recipient.access_code_verified_at
      ? await mapSigningEnvelopeToDtoWithEkyc(envelope)
      : mapSigningEnvelopeToDto({
          ...envelope,
          documents: envelope.documents.filter((document) => recipientDocumentIds.has(document.id)),
          recipients: envelope.recipients.filter((item) => item.id === recipient.id),
          assignments: envelope.assignments.filter(
            (assignment) => assignment.recipient_id === recipient.id
          ),
        });

    return {
      envelope: envelopeDto,
      recipient_id: recipient.id,
      access_verified: recipient.access_code_verified_at != null,
      kyc_required: recipient.kyc_required,
      kyc_status,
      package_closed: packageClosed,
    };
  }

  async getEnvelopeForExternalToken(accessToken: string): Promise<ExternalSigningSessionDto> {
    const { envelope, recipient } = await this.resolveExternalTokenSession(accessToken);
    return this.mapExternalSession(envelope, recipient, isClosedEnvelopeStatus(envelope.status));
  }

  async verifyExternalAccessCode(
    accessToken: string,
    icNumber: string
  ): Promise<ExternalSigningSessionDto> {
    const { envelope, recipientId, recipient } = await this.requireExternalTokenSession(accessToken);
    const provided = normalizeSigningIcNumber(icNumber);
    if (!isValidSigningIcNumber(provided)) {
      throw new AppError(400, "VALIDATION_ERROR", "A valid 12-digit MyKad number is required.");
    }

    // Email-level verified MyKad is authoritative — wrong IC must not bind or overwrite it.
    await assertProvidedIcCompatibleWithEmailEkyc(recipient.email, provided);

    const expected = normalizeSigningIcNumber(String(recipient.ic_number ?? ""));
    if (!expected) {
      await this.repo.bindRecipientIcAndVerifyAccess(recipientId, provided);
    } else if (expected !== provided) {
      throw new AppError(403, "ACCESS_CODE_INVALID", "The MyKad number does not match our records.");
    } else if (!recipient.access_code_verified_at) {
      await this.repo.markRecipientAccessCodeVerified(recipientId);
    }

    const refreshed = await this.requireEnvelope(envelope.id);
    const updatedRecipient = refreshed.recipients.find((item) => item.id === recipientId)!;
    return this.mapExternalSession(refreshed, updatedRecipient);
  }

  /**
   * Return the signer to the IC entry step before eKYC is verified.
   * Guarantors / self-declare roles clear bound IC; directors keep the offer-time IC.
   */
  async resetExternalAccessGate(accessToken: string): Promise<ExternalSigningSessionDto> {
    const { envelope, recipientId, recipient } = await this.requireExternalTokenSession(accessToken);

    const kycStatus = await resolveSigningKycStatus({
      kycRequired: recipient.kyc_required,
      email: recipient.email,
      icNumber: recipient.ic_number,
    });
    if (kycStatus === "VERIFIED") {
      throw new AppError(
        409,
        "EKYC_ALREADY_VERIFIED",
        "Identity verification is already complete. You cannot change the MyKad number."
      );
    }

    const keepBoundIc = roleRequiresBindingIcAtOffer({
      key: recipient.role_key,
    });
    await this.repo.clearRecipientAccessGate(recipientId, { clearIcNumber: !keepBoundIc });

    const refreshed = await this.requireEnvelope(envelope.id);
    const updatedRecipient = refreshed.recipients.find((item) => item.id === recipientId)!;
    return this.mapExternalSession(refreshed, updatedRecipient);
  }

  async createRecipientEkycSession(input: {
    accessToken: string;
    confirmedName?: string | null;
    force?: boolean;
  }): Promise<RecipientEkycSession> {
    const { envelope, recipientId } = await this.requireExternalTokenSession(input.accessToken);
    const recipient = envelope.recipients.find((item) => item.id === recipientId);
    if (!recipient) {
      throw new AppError(404, "SIGNING_RECIPIENT_NOT_FOUND", "Recipient not found.");
    }
    if (!recipient.access_code_verified_at) {
      throw new AppError(403, "ACCESS_CODE_REQUIRED", "Verify your MyKad number before starting identity verification.");
    }
    if (!recipient.kyc_required) {
      throw new AppError(409, "EKYC_NOT_REQUIRED", "Identity verification is not required for this signer.");
    }

    const application = await this.requireApplicationContext(envelope.application_id);
    const session = await ekycService.createExternalSignerSession({
      email: recipient.email,
      icNumber: String(recipient.ic_number ?? ""),
      confirmedNameInput: input.confirmedName?.trim() || recipient.name,
      issuerOrganizationId: application.issuer_organization_id,
      force: input.force,
    });

    return {
      url: session.url,
      token: session.token,
      sdk_endpoint: session.url,
    };
  }

  async getRecipientEkycStatus(kycSessionToken: string): Promise<RecipientEkycSessionStatus> {
    return ekycService.getRecipientSessionStatus(kycSessionToken);
  }

  async failRecipientEkyc(kycSessionToken: string, reason: string): Promise<RecipientEkycSessionStatus> {
    const status = await ekycService.failSession(kycSessionToken, reason);
    return {
      status:
        status.status === "verified"
          ? "verified"
          : status.status === "failed"
            ? "failed"
            : status.status === "error"
              ? "error"
              : "pending",
      last_error: status.error,
    };
  }

  async completeRecipientEkyc(
    kycSessionToken: string,
    result: unknown
  ): Promise<RecipientEkycSessionStatus> {
    const status = await ekycService.completeSession(kycSessionToken, result);
    return {
      status:
        status.status === "verified"
          ? "verified"
          : status.status === "failed"
            ? "failed"
            : status.status === "error"
              ? "error"
              : "pending",
      last_error: status.error,
    };
  }

  private async requireEnvelope(id: string): Promise<SigningEnvelopeWithGraph> {
    const envelope = await this.repo.findById(id);
    if (!envelope) {
      throw new AppError(404, "SIGNING_ENVELOPE_NOT_FOUND", "Signing envelope not found.");
    }
    return envelope;
  }

  async sendEnvelope(id: string): Promise<SigningEnvelopeDto> {
    const envelope = await this.requireEnvelope(id);
    if (envelope.status !== "DRAFT") {
      throw new AppError(409, "SIGNING_ENVELOPE_NOT_DRAFT", "Only draft envelopes can be sent.");
    }

    const recipientById = new Map(envelope.recipients.map((r) => [r.id, r]));
    const application = await this.requireApplicationContext(envelope.application_id);
    await this.assertOfferAcceptanceAllowsSigning(
      application,
      envelope.contract_id ?? null,
      envelope.invoice_id ?? null,
      "send"
    );

    for (const document of [...envelope.documents].sort((a, b) => a.order - b.order)) {
      if (document.provider_contract_ref) {
        continue;
      }
      const docAssignments = envelope.assignments.filter((a) => a.document_id === document.id);
      if (docAssignments.length === 0) continue;

      let signsetsByAssignmentId = new Map<string, unknown>();
      let unsignedS3Key = document.unsigned_s3_key;

      if (document.source === "GENERATED_OFFER_LETTER") {
        const materialized = await this.materializeGeneratedOfferLetter(
          envelope,
          document.id,
          application,
          docAssignments,
          recipientById
        );
        unsignedS3Key = materialized.s3Key;
        signsetsByAssignmentId = materialized.signsetsByAssignmentId;
      } else if (document.source === "ISSUER_UPLOAD") {
        if (!unsignedS3Key) {
          throw new AppError(
            422,
            "SIGNING_DOCUMENT_NOT_READY",
            `Document "${document.name}" has no uploaded file to sign.`
          );
        }
      } else if (document.source === "TEMPLATE") {
        const materialized = await this.materializeTemplateSigningDocument(
          envelope,
          document,
          docAssignments,
          recipientById
        );
        unsignedS3Key = materialized.s3Key;
        signsetsByAssignmentId = materialized.signsetsByAssignmentId;
      } else {
        throw new AppError(
          422,
          "SIGNING_DOCUMENT_NOT_SUPPORTED",
          `Document "${document.name}" is not supported yet.`
        );
      }

      if (!unsignedS3Key) {
        throw new AppError(
          422,
          "SIGNING_DOCUMENT_NOT_READY",
          `Document "${document.name}" has no file to sign.`
        );
      }

      const pdfBuffer = await getS3ObjectBuffer(unsignedS3Key);
      const orderedAssignments = this.orderDocumentAssignments(docAssignments, recipientById);
      const signers = orderedAssignments.map(({ assignment, recipient }) => ({
        email: recipient.email,
        signset:
          signsetsByAssignmentId.get(assignment.id) ??
          assignment.signset ??
          undefined,
      }));

      const { providerRef } = await this.provider.createDocumentContract({
        pdfBuffer,
        contractName: `${envelope.title} — ${document.name}`,
        signers,
      });
      await this.repo.markDocumentSent(document.id, providerRef);
    }

    const expiresAt = new Date(Date.now() + EXTERNAL_ACCESS_TOKEN_TTL_MS);
    let allEmailsDelivered = true;
    for (const recipient of envelope.recipients) {
      const accessToken = generateSigningAccessToken();
      await this.repo.setRecipientAccessToken(recipient.id, accessToken, expiresAt);
      const delivered = await this.sendSigningEmail({
        envelope,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        accessToken,
        isReminder: false,
      });
      await this.repo.setRecipientEmailDeliveryStatus(
        recipient.id,
        delivered ? "sent" : "failed",
        delivered ? null : "Email delivery failed"
      );
      if (!delivered) allEmailsDelivered = false;
    }

    if (!allEmailsDelivered) {
      throw new AppError(
        502,
        "SIGNING_EMAIL_DELIVERY_FAILED",
        "One or more signing invitation emails could not be delivered. The package was not marked as sent."
      );
    }

    await this.repo.markEnvelopeSent(id);
    await this.markOfferAcceptanceSigningInProgress(envelope);
    if (envelope.created_by_user_id) {
      await this.logSigningPackageActivity({
        userId: envelope.created_by_user_id,
        applicationId: envelope.application_id,
        eventType: ApplicationLogEventType.SIGNING_PACKAGE_SENT,
        envelope,
      });
    }
    return this.getEnvelope(id);
  }

  private orderDocumentAssignments(
    docAssignments: SigningEnvelopeWithGraph["assignments"],
    recipientById: Map<string, SigningEnvelopeWithGraph["recipients"][number]>
  ) {
    return docAssignments
      .map((assignment) => {
        const recipient = recipientById.get(assignment.recipient_id);
        return recipient ? { assignment, recipient } : null;
      })
      .filter(
        (
          row
        ): row is {
          assignment: SigningEnvelopeWithGraph["assignments"][number];
          recipient: SigningEnvelopeWithGraph["recipients"][number];
        } => row != null
      )
      .sort((a, b) => {
        const orderDiff = a.recipient.routing_order - b.recipient.routing_order;
        if (orderDiff !== 0) return orderDiff;
        return a.recipient.name.localeCompare(b.recipient.name);
      });
  }

  private resolveOfferLetterSignatories(
    docAssignments: SigningEnvelopeWithGraph["assignments"],
    recipientById: Map<string, SigningEnvelopeWithGraph["recipients"][number]>
  ): OfferLetterSignatory[] {
    return this.orderDocumentAssignments(docAssignments, recipientById).map(({ recipient }) => ({
      name: recipient.name,
      email: recipient.email,
    }));
  }

  private async materializeGeneratedOfferLetter(
    envelope: SigningEnvelopeWithGraph,
    documentId: string,
    application: SigningApplicationContext,
    docAssignments: SigningEnvelopeWithGraph["assignments"],
    recipientById: Map<string, SigningEnvelopeWithGraph["recipients"][number]>
  ): Promise<{ s3Key: string; signsetsByAssignmentId: Map<string, unknown> }> {
    const signatories = this.resolveOfferLetterSignatories(docAssignments, recipientById);
    if (signatories.length === 0) {
      throw new AppError(
        422,
        "SIGNING_DOCUMENT_NOT_READY",
        "Generated offer letter requires at least one signer."
      );
    }

    const orderedAssignments = this.orderDocumentAssignments(docAssignments, recipientById);
    let generated: Awaited<ReturnType<typeof generateContractOfferLetterBuffer>>;

    if (envelope.invoice_id) {
      const invoice = application.invoices.find((item) => item.id === envelope.invoice_id);
      if (!invoice?.offer_details || typeof invoice.offer_details !== "object") {
        throw new AppError(400, "INVALID_STATE", "Invoice offer details are not available.");
      }
      generated = await generateInvoiceOfferLetterBuffer(
        invoice.id,
        invoice.offer_details as Record<string, unknown>,
        signatories
      );
    } else if (envelope.contract_id) {
      const contract = application.contract;
      if (
        !contract ||
        contract.id !== envelope.contract_id ||
        !contract.offer_details ||
        typeof contract.offer_details !== "object"
      ) {
        throw new AppError(400, "INVALID_STATE", "Contract offer details are not available.");
      }
      generated = await generateContractOfferLetterBuffer(
        contract.id,
        contract.offer_details as Record<string, unknown>,
        signatories
      );
    } else {
      throw new AppError(400, "INVALID_STATE", "Generated offer letter needs a contract or invoice target.");
    }

    if (generated.signsets.length !== orderedAssignments.length) {
      throw new AppError(
        500,
        "SIGNING_LAYOUT_ERROR",
        "Offer letter signature layout does not match signer count."
      );
    }

    const signsetsByAssignmentId = new Map<string, unknown>();
    for (let index = 0; index < orderedAssignments.length; index += 1) {
      const signset = generated.signsets[index];
      const { assignment } = orderedAssignments[index];
      signsetsByAssignmentId.set(assignment.id, signset);
      await this.repo.setAssignmentSignset(assignment.id, signset);
    }

    const s3Key = `applications/${envelope.application_id}/signing/${envelope.id}/unsigned/${documentId}.pdf`;
    await putS3ObjectBuffer({ key: s3Key, body: generated.pdfBuffer, contentType: "application/pdf" });
    await this.repo.setDocumentUnsignedS3Key(documentId, s3Key);
    return { s3Key, signsetsByAssignmentId };
  }

  private async materializeTemplateSigningDocument(
    envelope: SigningEnvelopeWithGraph,
    document: SigningEnvelopeWithGraph["documents"][number],
    docAssignments: SigningEnvelopeWithGraph["assignments"],
    recipientById: Map<string, SigningEnvelopeWithGraph["recipients"][number]>
  ): Promise<{ s3Key: string; signsetsByAssignmentId: Map<string, unknown> }> {
    if (document.unsigned_s3_key) {
      return { s3Key: document.unsigned_s3_key, signsetsByAssignmentId: new Map() };
    }

    if (document.template_ref === GUARANTOR_AGREEMENT_TEMPLATE_KEY) {
      const signatories = this.resolveOfferLetterSignatories(docAssignments, recipientById);
      if (signatories.length === 0) {
        throw new AppError(
          422,
          "SIGNING_DOCUMENT_NOT_READY",
          "Guarantor agreement requires at least one signer."
        );
      }

      const orderedAssignments = this.orderDocumentAssignments(docAssignments, recipientById);
      const generated = await generateGuarantorAgreementPlaceholderBuffer(signatories);
      if (generated.signsets.length !== orderedAssignments.length) {
        throw new AppError(
          500,
          "SIGNING_LAYOUT_ERROR",
          "Guarantor agreement signature layout does not match signer count."
        );
      }

      const signsetsByAssignmentId = new Map<string, unknown>();
      for (let index = 0; index < orderedAssignments.length; index += 1) {
        const signset = generated.signsets[index];
        const { assignment } = orderedAssignments[index];
        signsetsByAssignmentId.set(assignment.id, signset);
        await this.repo.setAssignmentSignset(assignment.id, signset);
      }

      const s3Key = `applications/${envelope.application_id}/signing/${envelope.id}/unsigned/${document.id}.pdf`;
      await putS3ObjectBuffer({ key: s3Key, body: generated.pdfBuffer, contentType: "application/pdf" });
      await this.repo.setDocumentUnsignedS3Key(document.id, s3Key);
      return { s3Key, signsetsByAssignmentId };
    }

    throw new AppError(
      422,
      "SIGNING_DOCUMENT_NOT_SUPPORTED",
      `Document "${document.name}" is not supported yet.`
    );
  }

  async sendEnvelopeForIssuer(id: string, userId: string): Promise<SigningEnvelopeDto> {
    const envelope = await this.requireEnvelope(id);
    const application = await this.requireApplicationContext(envelope.application_id);
    await this.assertIssuerApplicationAccess(application, userId);
    await this.assertAcceptanceDocumentsReady(application);
    return this.sendEnvelope(id);
  }

  private async assertRecipientCanSign(
    recipient: SigningEnvelopeWithGraph["recipients"][number]
  ): Promise<void> {
    if (!recipient.access_code_verified_at) {
      throw new AppError(403, "ACCESS_CODE_REQUIRED", "Verify your IC number before signing.");
    }
    const kycStatus = await resolveSigningKycStatus({
      kycRequired: recipient.kyc_required,
      email: recipient.email,
      icNumber: recipient.ic_number,
    });
    if (kycStatus === "PENDING" || kycStatus === "FAILED") {
      throw new AppError(403, "EKYC_REQUIRED", "Complete identity verification before signing.");
    }
  }

  async startRecipientSigning(input: {
    envelopeId: string;
    recipientId: string;
    documentId: string;
    redirectUrl?: string | null;
    returnSessionId?: string;
  }): Promise<{ signingUrl: string; returnSessionId?: string }> {
    const envelope = await this.requireEnvelope(input.envelopeId);
    const document = envelope.documents.find((d) => d.id === input.documentId);
    const recipient = envelope.recipients.find((r) => r.id === input.recipientId);
    if (!document || !recipient) {
      throw new AppError(404, "SIGNING_ASSIGNMENT_NOT_FOUND", "Document or recipient not found.");
    }
    if (isClosedEnvelopeStatus(envelope.status)) {
      throw new AppError(409, "SIGNING_ENVELOPE_CLOSED", "This signing package is closed.");
    }
    await this.assertRecipientCanSign(recipient);
    const assignment = envelope.assignments.find(
      (item) =>
        item.document_id === document.id &&
        item.recipient_id === recipient.id &&
        item.action === "SIGN"
    );
    if (!assignment) {
      throw new AppError(404, "SIGNING_ASSIGNMENT_NOT_FOUND", "This recipient does not sign this document.");
    }
    if (assignment.status === "SIGNED") {
      throw new AppError(409, "SIGNING_ASSIGNMENT_COMPLETE", "This signing step is already complete.");
    }
    if (!document.provider_contract_ref) {
      throw new AppError(409, "SIGNING_DOCUMENT_NOT_SENT", "This document has not been sent yet.");
    }
    const callbackUrl = buildSigningCloudCallbackUrl();
    if (!callbackUrl) {
      logger.warn(
        { envelopeId: envelope.id, documentId: document.id },
        "SigningCloud callUrl omitted: API_PUBLIC_URL / API_URL is not set"
      );
    }

    let redirectUrl = input.redirectUrl ?? null;
    let returnSessionId = input.returnSessionId;
    if (returnSessionId) {
      redirectUrl = buildSigningReturnUrl(returnSessionId);
    } else if (redirectUrl) {
      redirectUrl = validateSigningRedirectUrl(redirectUrl);
    }

    const session = await this.provider.startSignerSession({
      providerRef: document.provider_contract_ref,
      signerEmail: recipient.email,
      redirectUrl,
      callbackUrl,
    });

    const signingSession: RecipientSigningSessionMeta = {
      documentId: document.id,
      startedAt: new Date().toISOString(),
      returnSessionId: returnSessionId ?? generateSigningAccessToken(),
    };
    await prisma.signingRecipient.update({
      where: { id: recipient.id },
      data: {
        metadata: mergeRecipientSigningSession(recipient.metadata, signingSession),
      },
    });
    return {
      signingUrl: session.signingUrl,
      returnSessionId: signingSession.returnSessionId,
    };
  }

  async startRecipientSigningForExternalToken(input: {
    accessToken: string;
    documentId: string;
  }): Promise<{ signingUrl: string; returnSessionId: string }> {
    const { envelope, recipientId } = await this.requireExternalTokenSession(input.accessToken);
    const returnSessionId = generateSigningAccessToken();
    const result = await this.startRecipientSigning({
      envelopeId: envelope.id,
      recipientId,
      documentId: input.documentId,
      returnSessionId,
    });
    return {
      signingUrl: result.signingUrl,
      returnSessionId: result.returnSessionId ?? returnSessionId,
    };
  }

  /**
   * Signer returned from SigningCloud via backUrl: sync from Get Document Detail, then
   * optionally trust the return when this recipient recently started signing this document
   * (provider lag / parse miss). Requires the same IC + eKYC gate as start-signing.
   * Webhook remains a best-effort backup for PDF storage.
   */
  async confirmRecipientSignedForExternalToken(input: {
    accessToken: string;
    documentId: string;
  }): Promise<ExternalSigningSessionDto> {
    const { envelope, recipientId, recipient } = await this.requireExternalTokenSession(
      input.accessToken
    );
    return this.confirmRecipientSigned({
      envelope,
      recipientId,
      recipient,
      documentId: input.documentId,
      accessToken: input.accessToken,
    });
  }

  async confirmRecipientSignedForReturnSession(
    returnSessionId: string
  ): Promise<ExternalSigningSessionDto> {
    const resolved = await this.repo.findRecipientByReturnSessionId(returnSessionId);
    if (!resolved) {
      throw new AppError(404, "SIGNING_RETURN_NOT_FOUND", "Signing return session not found.");
    }
    const recipient = resolved.envelope.recipients.find((item) => item.id === resolved.recipientId);
    if (!recipient) {
      throw new AppError(403, "SIGNING_LINK_INVALID", "Signing link is not valid for this recipient.");
    }
    if (
      recipient.access_token_expires_at &&
      recipient.access_token_expires_at.getTime() < Date.now()
    ) {
      throw new AppError(410, "SIGNING_LINK_EXPIRED", "This signing link has expired.");
    }

    if (isClosedEnvelopeStatus(resolved.envelope.status)) {
      return this.mapExternalSession(resolved.envelope, recipient, true);
    }

    const sessionMeta = readRecipientSigningSession(recipient.metadata);
    if (!sessionMeta || sessionMeta.returnSessionId !== returnSessionId) {
      throw new AppError(404, "SIGNING_RETURN_NOT_FOUND", "Signing return session not found.");
    }

    return this.confirmRecipientSigned({
      envelope: resolved.envelope,
      recipientId: resolved.recipientId,
      recipient,
      documentId: sessionMeta.documentId,
    });
  }

  private async confirmRecipientSigned(input: {
    envelope: SigningEnvelopeWithGraph;
    recipientId: string;
    recipient: SigningEnvelopeWithGraph["recipients"][number];
    documentId: string;
    accessToken?: string;
  }): Promise<ExternalSigningSessionDto> {
    await this.assertRecipientCanSign(input.recipient);

    const document = input.envelope.documents.find((d) => d.id === input.documentId);
    if (!document) {
      throw new AppError(404, "SIGNING_DOCUMENT_NOT_FOUND", "Document not found.");
    }

    const assignment = input.envelope.assignments.find(
      (item) =>
        item.document_id === document.id &&
        item.recipient_id === input.recipientId &&
        item.action === "SIGN"
    );
    if (!assignment) {
      throw new AppError(
        404,
        "SIGNING_ASSIGNMENT_NOT_FOUND",
        "This recipient does not sign this document."
      );
    }

    if (!isClosedEnvelopeStatus(input.envelope.status)) {
      await this.syncEnvelopeFromProvider(input.envelope.id);
    }

    const afterSync = await this.requireEnvelope(input.envelope.id);
    const syncedAssignment = afterSync.assignments.find((item) => item.id === assignment.id);
    if (
      !isClosedEnvelopeStatus(afterSync.status) &&
      syncedAssignment &&
      syncedAssignment.status !== "SIGNED" &&
      syncedAssignment.status !== "DECLINED"
    ) {
      const session = readRecipientSigningSession(input.recipient.metadata);
      const startedAtMs = session?.startedAt ? Date.parse(session.startedAt) : NaN;
      const sessionIsFresh =
        session?.documentId === document.id &&
        Number.isFinite(startedAtMs) &&
        Date.now() - startedAtMs <= TRUST_RETURN_SESSION_MAX_MS;

      if (sessionIsFresh) {
        await this.repo.markAssignmentSigned(assignment.id);
        await this.rollupEnvelope(input.envelope.id);
        logger.info(
          {
            envelopeId: input.envelope.id,
            documentId: document.id,
            recipientId: input.recipientId,
          },
          "Signing assignment confirmed via signer return after recent start-signing (provider detail did not mark SIGNED)"
        );
      } else {
        logger.info(
          {
            envelopeId: input.envelope.id,
            documentId: document.id,
            recipientId: input.recipientId,
            hasSession: Boolean(session),
          },
          "Skipping trust-return: no recent start-signing session for this document"
        );
      }
    }

    if (input.accessToken) {
      return this.getEnvelopeForExternalToken(input.accessToken);
    }
    return this.mapExternalSession(
      await this.requireEnvelope(input.envelope.id),
      afterSync.recipients.find((item) => item.id === input.recipientId)!,
      isClosedEnvelopeStatus(afterSync.status)
    );
  }

  /** External signer: refresh assignment statuses from SigningCloud document detail. */
  async syncEnvelopeFromProviderForExternalToken(
    accessToken: string
  ): Promise<ExternalSigningSessionDto> {
    const { envelope, recipient } = await this.resolveExternalTokenSession(accessToken);
    if (!isClosedEnvelopeStatus(envelope.status)) {
      await this.syncEnvelopeFromProvider(envelope.id);
    }
    const refreshed = await this.requireEnvelope(envelope.id);
    const updatedRecipient = refreshed.recipients.find((item) => item.id === recipient.id)!;
    return this.mapExternalSession(
      refreshed,
      updatedRecipient,
      isClosedEnvelopeStatus(refreshed.status)
    );
  }

  /** Issuer: refresh assignment statuses from SigningCloud document detail. */
  async syncEnvelopeFromProviderForIssuer(
    envelopeId: string,
    userId: string
  ): Promise<SigningEnvelopeDto> {
    const envelope = await this.requireEnvelope(envelopeId);
    const application = await this.requireApplicationContext(envelope.application_id);
    await this.assertIssuerApplicationAccess(application, userId);
    // Still sync COMPLETED envelopes so a missed webhook can store the signed PDF.
    if (envelope.status !== "VOIDED" && envelope.status !== "DECLINED" && envelope.status !== "EXPIRED") {
      await this.syncEnvelopeFromProvider(envelopeId);
    }
    return this.getEnvelope(envelopeId);
  }

  /**
   * Pull live per-signer status from the provider (SigningCloud Get Document Detail)
   * and update assignments by email. Fetches signed PDFs when a document is complete.
   */
  async syncEnvelopeFromProvider(envelopeId: string): Promise<void> {
    let envelope = await this.requireEnvelope(envelopeId);
    let assignmentsChanged = false;
    let detailAttempts = 0;
    let detailFailures = 0;

    for (const document of envelope.documents) {
      if (!document.provider_contract_ref || document.status === "VOIDED") continue;
      detailAttempts += 1;

      let details;
      try {
        details = await this.provider.getContractDetails({
          providerRef: document.provider_contract_ref,
        });
      } catch (err) {
        detailFailures += 1;
        logger.warn(
          { err, envelopeId, documentId: document.id },
          "SigningCloud getContractDetails failed during sync"
        );
        continue;
      }

      if (details.signers.length === 0) {
        detailFailures += 1;
        logger.warn(
          {
            envelopeId,
            documentId: document.id,
            documentState: details.documentState,
            providerRefPrefix: document.provider_contract_ref.slice(0, 8),
          },
          "SigningCloud getContractDetails returned no signer rows"
        );
        continue;
      }

      const statusByEmail = new Map(
        details.signers.map((signer) => [normalizeSigningEmail(signer.email), signer.status])
      );

      for (const assignment of envelope.assignments) {
        if (assignment.document_id !== document.id || assignment.action !== "SIGN") continue;
        const recipient = envelope.recipients.find((r) => r.id === assignment.recipient_id);
        if (!recipient) continue;

        const providerStatus = statusByEmail.get(normalizeSigningEmail(recipient.email));
        if (!providerStatus) {
          logger.warn(
            {
              envelopeId,
              documentId: document.id,
              recipientEmail: normalizeSigningEmail(recipient.email),
              providerEmails: [...statusByEmail.keys()],
            },
            "SigningCloud detail has no matching signer email for assignment"
          );
          continue;
        }

        if (providerStatus === "SIGNED" && assignment.status !== "SIGNED") {
          await this.repo.markAssignmentSigned(assignment.id);
          assignmentsChanged = true;
        } else if (providerStatus === "REJECTED" && assignment.status !== "DECLINED") {
          await this.repo.markAssignmentDeclined(assignment.id);
          assignmentsChanged = true;
        }
      }
    }

    if (assignmentsChanged) {
      await this.rollupEnvelope(envelopeId);
      envelope = await this.requireEnvelope(envelopeId);
    }

    let pdfFailures = 0;
    for (const document of envelope.documents) {
      if (!document.provider_contract_ref || document.signed_s3_key) continue;
      if (document.status !== "COMPLETED") continue;

      try {
        const { pdfBuffer, sha256 } = await this.provider.fetchSignedDocument({
          providerRef: document.provider_contract_ref,
        });
        const s3Key = `applications/${envelope.application_id}/signing/${envelope.id}/${document.id}.pdf`;
        await putS3ObjectBuffer({ key: s3Key, body: pdfBuffer, contentType: "application/pdf" });
        await this.repo.recordSignedDocument(document.id, s3Key, sha256, "COMPLETED");
        logger.info(
          { envelopeId, documentId: document.id },
          "Stored signed PDF after provider detail sync"
        );
      } catch (err) {
        pdfFailures += 1;
        logger.warn(
          { err, envelopeId, documentId: document.id },
          "Failed to fetch signed PDF during provider sync"
        );
      }
    }

    if (envelope.status === "COMPLETED") {
      envelope = await this.requireEnvelope(envelopeId);
      await this.finalizeCompletedEnvelopeOffer(envelope);
    }

    if (detailAttempts > 0 && detailFailures === detailAttempts) {
      throw new AppError(
        502,
        "SIGNING_PROVIDER_SYNC_FAILED",
        "Could not sync signing status from the provider."
      );
    }

    if (detailFailures > 0 || pdfFailures > 0) {
      logger.warn(
        { envelopeId, detailFailures, pdfFailures, assignmentsChanged },
        "Partial failure syncing signing envelope from provider"
      );
    } else {
      logger.info({ envelopeId, assignmentsChanged }, "Synced signing envelope from provider");
    }
  }

  async applyProviderContractSigned(providerContractRef: string): Promise<{ skipped: boolean }> {
    const envelope = await this.repo.findByDocumentProviderRef(providerContractRef);
    if (!envelope) return { skipped: true };

    if (isClosedEnvelopeStatus(envelope.status)) {
      logger.info(
        { envelopeId: envelope.id, providerContractRef, status: envelope.status },
        "Ignoring SigningCloud webhook for closed envelope"
      );
      return { skipped: true };
    }

    await this.syncEnvelopeFromProvider(envelope.id);
    logger.info(
      { envelopeId: envelope.id, providerContractRef },
      "Signing envelope synced via provider callback"
    );
    return { skipped: false };
  }

  private async rollupEnvelope(envelopeId: string): Promise<void> {
    const envelope = await this.requireEnvelope(envelopeId);
    const assignmentInputs: AssignmentStatusInput[] = envelope.assignments.map((a) => ({
      status: a.status,
      required: a.required,
    }));

    for (const recipient of envelope.recipients) {
      const statuses = envelope.assignments
        .filter((a) => a.recipient_id === recipient.id)
        .map((a) => a.status);
      const next = rollupRecipientStatus(statuses);
      if (next !== recipient.status) {
        await this.repo.updateRecipientStatus(recipient.id, next, next === "SIGNED");
      }
    }

    for (const document of envelope.documents) {
      const docAssignments = envelope.assignments
        .filter((a) => a.document_id === document.id)
        .map((a) => ({ status: a.status, required: a.required }));
      const next = rollupDocumentStatus(docAssignments);
      if (next !== document.status && document.status !== "VOIDED") {
        await this.repo.updateDocumentStatus(document.id, next);
      }
    }

    const nextEnvelopeStatus = rollupEnvelopeStatus(assignmentInputs);
    if (nextEnvelopeStatus !== envelope.status) {
      const updated = await this.repo.updateEnvelopeStatusIfCurrent(
        envelopeId,
        envelope.status,
        nextEnvelopeStatus,
        nextEnvelopeStatus === "COMPLETED"
      );
      if (!updated) {
        logger.info(
          { envelopeId, expectedStatus: envelope.status, nextEnvelopeStatus },
          "Skipped envelope rollup — status changed concurrently"
        );
        return;
      }

      if (nextEnvelopeStatus === "COMPLETED") {
        if (envelope.created_by_user_id) {
          await this.logSigningPackageActivity({
            userId: envelope.created_by_user_id,
            applicationId: envelope.application_id,
            eventType: ApplicationLogEventType.SIGNING_PACKAGE_COMPLETED,
            envelope,
          });
        }
        await this.finalizeCompletedEnvelopeOffer(envelope);
      } else if (nextEnvelopeStatus === "DECLINED") {
        if (envelope.created_by_user_id) {
          await this.logSigningPackageActivity({
            userId: envelope.created_by_user_id,
            applicationId: envelope.application_id,
            eventType: ApplicationLogEventType.SIGNING_PACKAGE_VOIDED,
            envelope,
            extraMetadata: { void_reason: "declined" },
          });
        }
        await this.rollbackOfferAcceptanceAfterEnvelopeClosed(envelope);
      }
    }
  }

  private async finalizeCompletedEnvelopeOffer(envelope: SigningEnvelopeWithGraph): Promise<void> {
    const initiatedByUserId = envelope.created_by_user_id;
    if (!initiatedByUserId) {
      logger.warn({ envelopeId: envelope.id }, "Skipping offer finalization for envelope without creator");
      return;
    }
    const signedDocument =
      envelope.documents.find((document) => document.source === "GENERATED_OFFER_LETTER" && document.signed_s3_key) ??
      envelope.documents.find((document) => document.signed_s3_key);
    if (!signedDocument?.signed_s3_key || !signedDocument.signed_file_sha256) {
      logger.warn({ envelopeId: envelope.id }, "Skipping offer finalization because no signed document is available");
      return;
    }

    const result = await applicationService.finalizeOfferAfterEnvelopeCompletion({
      applicationId: envelope.application_id,
      contractId: envelope.contract_id,
      invoiceId: envelope.invoice_id,
      initiatedByUserId,
      signedOfferLetterS3Key: signedDocument.signed_s3_key,
      signedFileSha256: signedDocument.signed_file_sha256,
    });
    logger.info(
      { envelopeId: envelope.id, skipped: result.skipped },
      "Processed offer finalization after signing envelope completion"
    );

    try {
      await this.markOfferAcceptanceCompleted(envelope);
    } catch (error) {
      logger.error(
        { error, envelopeId: envelope.id },
        "Failed to mark offer_acceptance COMPLETED after envelope finalization"
      );
    }
  }

  async voidEnvelope(
    id: string,
    reason: string | null,
    options?: { userId?: string; portal?: ActivityPortal }
  ): Promise<SigningEnvelopeDto> {
    const envelope = await this.requireEnvelope(id);
    if (envelope.status === "COMPLETED" || envelope.status === "VOIDED") {
      throw new AppError(409, "SIGNING_ENVELOPE_NOT_VOIDABLE", "This envelope can no longer be voided.");
    }
    await this.repo.voidEnvelope(id, reason);
    await this.rollbackOfferAcceptanceAfterEnvelopeClosed(envelope);
    const actorUserId = options?.userId ?? envelope.created_by_user_id;
    if (actorUserId) {
      await this.logSigningPackageActivity({
        userId: actorUserId,
        applicationId: envelope.application_id,
        eventType: ApplicationLogEventType.SIGNING_PACKAGE_VOIDED,
        envelope,
        portal: options?.portal ?? ActivityPortal.ADMIN,
        extraMetadata: reason?.trim() ? { void_reason: reason.trim() } : undefined,
      });
    }
    return this.getEnvelope(id);
  }

  async remindRecipient(envelopeId: string, recipientId: string): Promise<void> {
    const envelope = await this.requireEnvelope(envelopeId);
    if (isClosedEnvelopeStatus(envelope.status)) {
      throw new AppError(409, "SIGNING_ENVELOPE_CLOSED", "This signing package is closed.");
    }
    const recipient = envelope.recipients.find((r) => r.id === recipientId);
    if (!recipient) {
      throw new AppError(404, "SIGNING_RECIPIENT_NOT_FOUND", "Recipient not found.");
    }
    if (recipient.status === "SIGNED" || recipient.status === "DECLINED") {
      throw new AppError(409, "SIGNING_RECIPIENT_CLOSED", "This recipient has already finished signing.");
    }
    const accessToken = generateSigningAccessToken();
    await this.repo.setRecipientAccessToken(
      recipient.id,
      accessToken,
      new Date(Date.now() + EXTERNAL_ACCESS_TOKEN_TTL_MS)
    );
    const delivered = await this.sendSigningEmail({
      envelope,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      accessToken,
      isReminder: true,
    });
    await this.repo.setRecipientEmailDeliveryStatus(
      recipient.id,
      delivered ? "sent" : "failed",
      delivered ? null : "Reminder email delivery failed"
    );
    if (!delivered) {
      throw new AppError(
        502,
        "SIGNING_EMAIL_DELIVERY_FAILED",
        "Could not deliver the signing reminder email."
      );
    }
    await this.repo.touchRecipientReminder(recipientId);
  }

  async remindRecipientForIssuer(envelopeId: string, recipientId: string, userId: string): Promise<void> {
    const envelope = await this.requireEnvelope(envelopeId);
    const application = await this.requireApplicationContext(envelope.application_id);
    await this.assertIssuerApplicationAccess(application, userId);
    await this.remindRecipient(envelopeId, recipientId);
  }

  private async sendSigningEmail(input: {
    envelope: SigningEnvelopeWithGraph;
    recipientEmail: string;
    recipientName: string;
    accessToken: string;
    isReminder: boolean;
  }): Promise<boolean> {
    const signingUrl = buildExternalSigningUrl(input.accessToken);
    if (!signingUrl) {
      logger.warn(
        { envelopeId: input.envelope.id, recipientEmail: input.recipientEmail },
        "Skipping signing email because ISSUER_URL is not configured"
      );
      return false;
    }

    try {
      const title = input.envelope.title || "CashSouk signing package";
      const safeTitle = escapeHtml(title);
      const safeName = escapeHtml(input.recipientName || "there");
      await sendEmail({
        to: input.recipientEmail,
        subject: input.isReminder ? `Reminder: ${title}` : `Signature requested: ${title}`,
        html: `
          <p>Hi ${safeName},</p>
          <p>You have been asked to sign <strong>${safeTitle}</strong>.</p>
          <p><a href="${signingUrl}">Open secure signing link</a></p>
          <p>This link is unique to you. You will be asked to confirm your IC number before signing.</p>
        `,
        text: `Hi ${input.recipientName || "there"},\n\nYou have been asked to sign ${title}.\n\nOpen your secure signing link: ${signingUrl}\n\nThis link is unique to you. You will be asked to confirm your IC number before signing.`,
      });
      return true;
    } catch (error) {
      logger.error(
        { error, envelopeId: input.envelope.id, recipientEmail: input.recipientEmail },
        "Failed to send signing email"
      );
      return false;
    }
  }
}

export const signingService = new SigningService();
