/**
 * Pure stage/CTA model for the admin Offer & acceptance tab.
 * CTA only names a stage to expand — it does not introduce mutations.
 */

import {
  getOfferAcceptanceFromOfferDetails,
  isCommercialOfferSendUnlocked,
  type OfferAcceptanceStatus,
  type ReviewSection,
} from "@cashsouk/types";
import type { ReviewSectionId } from "../review-registry";
import { resolveInvoiceReviewItemStatus } from "../sections/invoice-review-scope";
import type { SectionActionLock, SectionActionLockMap } from "./resolve-section-action-lock";

export type OfferAcceptanceStructureType =
  | "new_contract"
  | "existing_contract"
  | "invoice_only";

export type OfferAcceptanceOfferType = "facility" | "invoice";

export type OfferAcceptanceStageId =
  | "facility_reference"
  | "facility_review"
  | "customer_review"
  | "invoice_review"
  | "send_offer"
  | "issuer_response"
  | "acceptance_documents"
  | "signing_package"
  | "inherited_acceptance";

export type OfferAcceptanceStageTone = "done" | "action" | "wait" | "locked";

export type OfferAcceptanceStageKind = "workflow" | "reference";

export type OfferAcceptanceStage = {
  id: OfferAcceptanceStageId;
  section: ReviewSectionId | null;
  title: string;
  tag: string;
  tone: OfferAcceptanceStageTone;
  summary: string;
  lockTooltip?: string;
  /** Reference blocks are context cards — not numbered rail stages. Default: workflow. */
  kind?: OfferAcceptanceStageKind;
};

export type OfferAcceptanceNextAction = {
  stageName: string;
  headline: string;
  detail: string;
  primaryLabel: string;
  targetStageId: OfferAcceptanceStageId;
};

export type OfferAcceptanceInvoiceInput = {
  id: string;
  status?: string | null;
  offer_details?: unknown;
  contract_id?: string | null;
  details?: unknown;
};

export type OfferAcceptanceEnvelopeInput = {
  status?: string | null;
  contract_id?: string | null;
  invoice_id?: string | null;
};

export type OfferAcceptanceReviewItemInput = {
  item_type: string;
  item_id: string;
  status: string;
};

export type OfferAcceptanceStageInput = {
  structureType?: string | null;
  contractStatus?: string | null;
  contractOfferDetails?: unknown;
  invoices?: OfferAcceptanceInvoiceInput[];
  selectedInvoiceId?: string | null;
  sectionStatuses?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  reviewItems?: OfferAcceptanceReviewItemInput[];
  signingEnvelopes?: OfferAcceptanceEnvelopeInput[];
  sectionLocks?: SectionActionLockMap;
  applicationWithdrawn?: boolean;
  /** Product has acceptance-document steps. Independent of the signing hub. */
  hasAcceptanceDocumentsSection?: boolean;
  /** Product defines a signing package. May be true when there are no acceptance documents. */
  hasSigningPackage?: boolean;
  sourceApplicationDisplayReference?: string | null;
  /** `applications.manage` — not documents.manage. SigningEnvelopePanel uses this. */
  canManageSigning?: boolean;
};

export type OfferAcceptanceStageModel = {
  structureType: OfferAcceptanceStructureType;
  offerType: OfferAcceptanceOfferType;
  stages: OfferAcceptanceStage[];
  nextAction: OfferAcceptanceNextAction | null;
  currentStageId: OfferAcceptanceStageId;
};

/** Statuses after a commercial offer was sent. Admin REJECTED is not an offer-sent state. */
const OFFER_SENT_OR_LATER = new Set([
  "OFFER_SENT",
  "OFFER_EXPIRED",
  "APPROVED",
  "WITHDRAWN",
]);

function normalizeStructureType(value?: string | null): OfferAcceptanceStructureType {
  if (value === "existing_contract" || value === "invoice_only" || value === "new_contract") {
    return value;
  }
  return "new_contract";
}

function readSectionStatus(
  statuses: OfferAcceptanceStageInput["sectionStatuses"],
  section: string
): string {
  if (!statuses) return "PENDING";
  if (statuses instanceof Map) return statuses.get(section) ?? "PENDING";
  const record = statuses as Readonly<Record<string, string>>;
  return record[section] ?? "PENDING";
}

function upper(value: string | null | undefined): string {
  return (value ?? "").toUpperCase();
}

function pickInvoice(
  invoices: OfferAcceptanceInvoiceInput[],
  selectedInvoiceId?: string | null
): OfferAcceptanceInvoiceInput | null {
  if (invoices.length === 0) return null;
  if (selectedInvoiceId) {
    const selected = invoices.find((invoice) => invoice.id === selectedInvoiceId);
    if (selected) return selected;
  }
  return invoices[invoices.length - 1] ?? null;
}

function lockFor(
  locks: SectionActionLockMap | undefined,
  section: ReviewSection
): SectionActionLock | undefined {
  return locks?.[section];
}

function commercialOfferDetails(
  offerType: OfferAcceptanceOfferType,
  contractOfferDetails: unknown,
  invoice: OfferAcceptanceInvoiceInput | null
): unknown {
  return offerType === "facility" ? contractOfferDetails : invoice?.offer_details;
}

function commercialEntityStatus(
  offerType: OfferAcceptanceOfferType,
  contractStatus: string | null | undefined,
  invoice: OfferAcceptanceInvoiceInput | null
): string {
  return offerType === "facility" ? upper(contractStatus) : upper(invoice?.status);
}

function acceptanceStatus(offerDetails: unknown): OfferAcceptanceStatus | null {
  return getOfferAcceptanceFromOfferDetails(offerDetails)?.status ?? null;
}

function invoiceReviewStatus(
  invoices: OfferAcceptanceInvoiceInput[],
  invoice: OfferAcceptanceInvoiceInput | null,
  reviewItems: OfferAcceptanceReviewItemInput[] | undefined
): string {
  const entity = upper(invoice?.status);
  if (entity === "WITHDRAWN" || entity === "OFFER_EXPIRED") return entity;
  return resolveInvoiceReviewItemStatus(invoices, invoice?.id, reviewItems);
}

export function isReferenceOfferAcceptanceStage(
  stage: Pick<OfferAcceptanceStage, "id" | "kind">
): boolean {
  return (
    stage.kind === "reference" ||
    stage.id === "facility_reference" ||
    stage.id === "inherited_acceptance"
  );
}

function envelopeStatus(
  envelopes: OfferAcceptanceEnvelopeInput[] | undefined,
  offerType: OfferAcceptanceOfferType,
  invoiceId: string | null
): string | null {
  if (!envelopes?.length) return null;
  const relevant = envelopes.filter((envelope) => {
    if (offerType === "invoice") {
      return invoiceId ? envelope.invoice_id === invoiceId : Boolean(envelope.invoice_id);
    }
    return Boolean(envelope.contract_id) && !envelope.invoice_id;
  });
  const statuses = relevant.map((envelope) => upper(envelope.status));
  if (statuses.includes("COMPLETED")) return "COMPLETED";
  if (statuses.includes("IN_PROGRESS") || statuses.includes("SENT")) return "IN_PROGRESS";
  if (statuses.includes("DRAFT")) return "DRAFT";
  return statuses[0] ?? null;
}

/** Section statuses that mean Customer/Facility review already finished. */
function isCompletedReviewStatus(status: string): boolean {
  return status === "APPROVED" || status === "COMPLETED";
}

/**
 * Action freeze (paymaster after offer, permission, prerequisites) still locks section
 * controls. Once the commercial offer is OFFER_SENT_OR_LATER, the rail presents a completed
 * review as done instead of Locked. Withdrawn and pre-offer locks stay locked.
 */
function isWorkflowReviewPresentationLocked(
  withdrawn: boolean,
  commercialOfferSent: boolean,
  actionLocked: boolean
): boolean {
  return withdrawn || (!commercialOfferSent && actionLocked);
}

function reviewTone(status: string, locked: boolean, lockTooltip?: string): Pick<
  OfferAcceptanceStage,
  "tone" | "tag" | "summary" | "lockTooltip"
> {
  if (locked) {
    return {
      tone: "locked",
      tag: "Locked",
      summary: lockTooltip || "Complete previous sections first.",
      lockTooltip,
    };
  }
  if (status === "REJECTED") {
    return { tone: "action", tag: "Rejected", summary: "Rejected — reset to pending before continuing." };
  }
  if (status === "AMENDMENT_REQUESTED") {
    return { tone: "action", tag: "Changes requested", summary: "Issuer must resubmit the flagged items." };
  }
  if (status === "APPROVED") {
    return { tone: "done", tag: "Approved", summary: "Review complete." };
  }
  return { tone: "action", tag: "Review", summary: "Review the submitted details." };
}

function sendOfferStage(args: {
  section: ReviewSectionId;
  offerType: OfferAcceptanceOfferType;
  entityStatus: string;
  reviewItemStatus?: string;
  reviewSectionStatus?: string;
  lock?: SectionActionLock;
  withdrawn: boolean;
}): OfferAcceptanceStage {
  const noun = args.offerType === "facility" ? "facility" : "invoice";
  const locked = args.withdrawn || !!args.lock?.locked;
  const base = { id: "send_offer" as const, section: args.section, title: "Send offer", kind: "workflow" as const };
  if (locked && !OFFER_SENT_OR_LATER.has(args.entityStatus)) {
    return {
      ...base,
      tag: "Locked",
      tone: "locked",
      summary: args.lock?.tooltip || "Approve earlier review stages before sending an offer.",
      lockTooltip: args.lock?.tooltip,
    };
  }
  if (args.entityStatus === "OFFER_EXPIRED") {
    return {
      ...base,
      tag: "Expired",
      tone: "action",
      summary: `The ${noun} offer expired. Set to pending, then send a new offer.`,
    };
  }
  if (args.entityStatus === "WITHDRAWN") {
    return {
      ...base,
      tag: "Declined",
      tone: "done",
      summary: `Issuer declined the ${noun} offer. Set to pending to send again.`,
    };
  }
  if (args.offerType === "invoice" && args.reviewItemStatus === "REJECTED") {
    return {
      ...base,
      tag: "Rejected",
      tone: "locked",
      summary: "This invoice was rejected. Set to pending before sending an offer.",
      lockTooltip: "This invoice was rejected. Use Action → Set to pending before sending an offer.",
    };
  }
  if (args.entityStatus === "REJECTED") {
    if (args.offerType === "facility") {
      return {
        ...base,
        tag: "Rejected",
        tone: "locked",
        summary: "This facility was rejected. Set to pending before sending an offer.",
        lockTooltip: "This facility was rejected. Use Action → Set to pending before sending an offer.",
      };
    }
  }
  if (args.entityStatus === "OFFER_SENT" || args.entityStatus === "APPROVED") {
    return {
      ...base,
      tag: args.entityStatus === "APPROVED" ? "Accepted" : "Sent",
      tone: "done",
      summary:
        args.entityStatus === "APPROVED"
          ? `Issuer accepted the ${noun} offer.`
          : `${noun === "facility" ? "Facility" : "Invoice"} offer sent. Set to pending to retract.`,
    };
  }
  const detailsStatus =
    args.offerType === "invoice" ? args.reviewItemStatus : args.reviewSectionStatus;
  if (
    !isCommercialOfferSendUnlocked({
      detailsStatus,
      entityStatus: args.entityStatus,
    })
  ) {
    const approveFirst =
      args.offerType === "facility"
        ? "Approve facility details before sending an offer."
        : "Approve invoice details before sending an offer.";
    return {
      ...base,
      tag: "Locked",
      tone: "locked",
      summary: approveFirst,
      lockTooltip: `${approveFirst} Use Action → Approve.`,
    };
  }
  if (args.entityStatus === "REJECTED" && args.offerType === "invoice") {
    return {
      ...base,
      tag: "Rejected",
      tone: "locked",
      summary: "This invoice was rejected. Set to pending before sending an offer.",
      lockTooltip: "This invoice was rejected. Use Action → Set to pending before sending an offer.",
    };
  }
  return {
    ...base,
    tag: "Ready",
    tone: "action",
    summary: `Set commercial terms and send the ${noun} offer.`,
  };
}

function isIssuerDeclinedOffer(
  entityStatus: string,
  acceptance: OfferAcceptanceStatus | null
): boolean {
  return entityStatus === "WITHDRAWN" || acceptance === "DECLINED";
}

function issuerResponseStage(args: {
  section: ReviewSectionId;
  offerType: OfferAcceptanceOfferType;
  entityStatus: string;
  acceptance: OfferAcceptanceStatus | null;
}): OfferAcceptanceStage {
  const noun = args.offerType === "facility" ? "facility" : "invoice";
  if (isIssuerDeclinedOffer(args.entityStatus, args.acceptance)) {
    return {
      id: "issuer_response",
      section: args.section,
      title: "Issuer response",
      tag: "Declined",
      tone: "done",
      summary: `Issuer declined the ${noun} offer.`,
    };
  }
  if (!OFFER_SENT_OR_LATER.has(args.entityStatus)) {
    return {
      id: "issuer_response",
      section: args.section,
      title: "Issuer response",
      tag: "Locked",
      tone: "locked",
      summary: `Send the ${noun} offer first.`,
      lockTooltip: `Send the ${noun} offer first.`,
    };
  }
  if (args.entityStatus === "OFFER_EXPIRED") {
    return {
      id: "issuer_response",
      section: args.section,
      title: "Issuer response",
      tag: "Expired",
      tone: "done",
      summary: `The ${noun} offer expired before the issuer responded.`,
    };
  }
  if (args.entityStatus === "APPROVED" || args.acceptance === "COMPLETED") {
    return {
      id: "issuer_response",
      section: args.section,
      title: "Issuer response",
      tag: "Accepted",
      tone: "done",
      summary: `Issuer accepted the ${noun} offer.`,
    };
  }
  if (args.acceptance === "CHANGES_REQUESTED") {
    return {
      id: "issuer_response",
      section: args.section,
      title: "Issuer response",
      tag: "Changes requested",
      tone: "wait",
      summary: "Waiting for the issuer to resubmit flagged representatives or documents.",
    };
  }
  if (
    args.acceptance === "PENDING_ADMIN_REVIEW" ||
    args.acceptance === "APPROVED_FOR_SIGNING" ||
    args.acceptance === "SIGNING_IN_PROGRESS"
  ) {
    return {
      id: "issuer_response",
      section: args.section,
      title: "Issuer response",
      tag: "Submitted",
      tone: "done",
      summary: "Issuer submitted authorised parties and acceptance documents.",
    };
  }
  return {
    id: "issuer_response",
    section: args.section,
    title: "Issuer response",
    tag: "Waiting",
    tone: "wait",
    summary:
      args.offerType === "facility"
        ? "Waiting for the issuer to accept the facility offer."
        : "Waiting for the issuer to accept the invoice offer.",
  };
}

function acceptanceDocumentsStage(args: {
  lock?: SectionActionLock;
  acceptance: OfferAcceptanceStatus | null;
  entityStatus: string;
}): OfferAcceptanceStage {
  if (isIssuerDeclinedOffer(args.entityStatus, args.acceptance)) {
    return {
      id: "acceptance_documents",
      section: "acceptance_documents",
      title: "Acceptance documents",
      tag: "Skipped",
      tone: "done",
      summary: "Acceptance documents are not required after the issuer declined the offer.",
    };
  }
  const lockedUntilOffer = !OFFER_SENT_OR_LATER.has(args.entityStatus);
  if (args.lock?.locked || lockedUntilOffer) {
    return {
      id: "acceptance_documents",
      section: "acceptance_documents",
      title: "Acceptance documents",
      tag: "Locked",
      tone: "locked",
      summary:
        args.lock?.tooltip ||
        (lockedUntilOffer
          ? "Send an offer to start acceptance."
          : "Acceptance documents appear here after the issuer submits them."),
      lockTooltip: args.lock?.tooltip,
    };
  }
  if (args.acceptance === "REJECTED") {
    return {
      id: "acceptance_documents",
      section: "acceptance_documents",
      title: "Acceptance documents",
      tag: "Rejected",
      tone: "action",
      summary: "Acceptance was rejected.",
    };
  }
  if (args.acceptance === "PENDING_ADMIN_REVIEW" || args.acceptance === "CHANGES_REQUESTED") {
    return {
      id: "acceptance_documents",
      section: "acceptance_documents",
      title: "Acceptance documents",
      tag: args.acceptance === "CHANGES_REQUESTED" ? "Changes requested" : "Pending review",
      tone: "action",
      summary:
        args.acceptance === "CHANGES_REQUESTED"
          ? "Issuer resubmitted after requested changes — review again."
          : "Review authorised parties and acceptance documents.",
    };
  }
  if (
    args.acceptance === "APPROVED_FOR_SIGNING" ||
    args.acceptance === "SIGNING_IN_PROGRESS" ||
    args.acceptance === "COMPLETED"
  ) {
    return {
      id: "acceptance_documents",
      section: "acceptance_documents",
      title: "Acceptance documents",
      tag: "Approved",
      tone: "done",
      summary: "Acceptance documents and representatives are approved.",
    };
  }
  return {
    id: "acceptance_documents",
    section: "acceptance_documents",
    title: "Acceptance documents",
    tag: "Waiting",
    tone: "wait",
    summary: "Acceptance documents appear here after the issuer submits them.",
  };
}

function signingPackageStage(args: {
  lock?: SectionActionLock;
  acceptance: OfferAcceptanceStatus | null;
  envelopeStatus: string | null;
  canManageSigning: boolean;
  entityStatus: string;
  requiresAcceptanceDocuments: boolean;
}): OfferAcceptanceStage {
  const acceptanceReady =
    args.acceptance === "APPROVED_FOR_SIGNING" ||
    args.acceptance === "SIGNING_IN_PROGRESS" ||
    args.acceptance === "COMPLETED";
  const signingOnlyReady =
    !args.requiresAcceptanceDocuments &&
    (args.entityStatus === "APPROVED" ||
      args.envelopeStatus === "SENT" ||
      args.envelopeStatus === "IN_PROGRESS" ||
      args.envelopeStatus === "COMPLETED");
  const readyForSigning = acceptanceReady || signingOnlyReady;
  if (isIssuerDeclinedOffer(args.entityStatus, args.acceptance)) {
    return {
      id: "signing_package",
      section: "acceptance_documents",
      title: "Signing package",
      tag: "Skipped",
      tone: "done",
      summary: "Signing is not required after the issuer declined the offer.",
    };
  }
  if (!readyForSigning) {
    const untilIssuerAccepts = "Locked until the issuer accepts the offer.";
    const untilDocsApproved = "Locked until acceptance documents and representatives are approved.";
    const summary = args.requiresAcceptanceDocuments ? untilDocsApproved : untilIssuerAccepts;
    return {
      id: "signing_package",
      section: "acceptance_documents",
      title: "Signing package",
      tag: "Locked",
      tone: "locked",
      summary: summary,
      lockTooltip: summary,
    };
  }
  if (args.acceptance === "COMPLETED" || args.envelopeStatus === "COMPLETED") {
    return {
      id: "signing_package",
      section: "acceptance_documents",
      title: "Signing package",
      tag: "Complete",
      tone: "done",
      summary: "Signing is complete.",
    };
  }
  if (args.acceptance === "SIGNING_IN_PROGRESS" || args.envelopeStatus === "IN_PROGRESS") {
    return {
      id: "signing_package",
      section: "acceptance_documents",
      title: "Signing package",
      tag: "In progress",
      tone: "wait",
      summary: "Waiting for authorised representatives to sign.",
    };
  }
  const acceptanceLockRelevant = Boolean(args.lock?.locked && args.lock.canManage);
  if (acceptanceLockRelevant || !args.canManageSigning) {
    return {
      id: "signing_package",
      section: "acceptance_documents",
      title: "Signing package",
      tag: "Locked",
      tone: "locked",
      summary:
        (acceptanceLockRelevant ? args.lock?.tooltip : undefined) ||
        "You do not have permission to send signing links.",
      lockTooltip: acceptanceLockRelevant ? args.lock?.tooltip : undefined,
    };
  }
  return {
    id: "signing_package",
    section: "acceptance_documents",
    title: "Signing package",
    tag: "Ready",
    tone: "action",
    summary: "Send signing links to the approved representatives.",
  };
}

function nextActionFor(stages: OfferAcceptanceStage[]): {
  currentStageId: OfferAcceptanceStageId;
  nextAction: OfferAcceptanceNextAction | null;
} {
  const workflow = stages.filter((stage) => !isReferenceOfferAcceptanceStage(stage));
  const declinedIssuer = workflow.find(
    (stage) => stage.id === "issuer_response" && stage.tag === "Declined"
  );
  const current =
    workflow.find((stage) => stage.tone === "action") ??
    workflow.find((stage) => stage.tone === "wait") ??
    declinedIssuer ??
    workflow[workflow.length - 1];
  if (!current) {
    return { currentStageId: "send_offer", nextAction: null };
  }
  return {
    currentStageId: current.id,
    nextAction: {
      stageName: current.title,
      headline: headlineFor(current),
      detail: current.summary,
      primaryLabel: `Go to ${current.title}`,
      targetStageId: current.id,
    },
  };
}

function headlineFor(stage: OfferAcceptanceStage): string {
  if (stage.id === "send_offer" && stage.tone === "action") {
    return stage.tag === "Expired" ? "Send a new offer" : "Send the offer";
  }
  if (stage.id === "issuer_response" && stage.tag === "Declined") {
    return "Issuer declined the offer";
  }
  if (stage.id === "issuer_response" && stage.tone === "wait") {
    return "Waiting on the issuer";
  }
  if (stage.id === "acceptance_documents" && stage.tone === "action") {
    return "Review acceptance documents";
  }
  if (stage.id === "signing_package" && stage.tone === "action") {
    return "Send signing links";
  }
  if (stage.tone === "done") {
    return "Offer & acceptance complete";
  }
  if (stage.tone === "locked") {
    return stage.title;
  }
  return `Continue with ${stage.title}`;
}

function facilityReferenceStage(sourceRef?: string | null): OfferAcceptanceStage {
  const ref = sourceRef?.trim();
  return {
    id: "facility_reference",
    section: "contract_details",
    title: ref ? `Facility (approved in ${ref})` : "Facility",
    tag: "Approved",
    tone: "done",
    summary: "Facility was approved in a prior application.",
    kind: "reference",
  };
}

function inheritedAcceptanceStage(sourceRef?: string | null): OfferAcceptanceStage {
  const ref = sourceRef?.trim();
  return {
    id: "inherited_acceptance",
    section: "acceptance_documents",
    title: "Facility acceptance & signing",
    tag: "Complete",
    tone: "done",
    summary: ref
      ? `Completed in originating application ${ref}.`
      : "Completed in the originating facility application.",
    kind: "reference",
  };
}

export function buildOfferAcceptanceStageModel(
  input: OfferAcceptanceStageInput
): OfferAcceptanceStageModel {
  const structureType = normalizeStructureType(input.structureType);
  const offerType: OfferAcceptanceOfferType = structureType === "new_contract" ? "facility" : "invoice";
  const invoices = input.invoices ?? [];
  const invoice = pickInvoice(invoices, input.selectedInvoiceId);
  const entityStatus = commercialEntityStatus(offerType, input.contractStatus, invoice);
  const offerDetails = commercialOfferDetails(offerType, input.contractOfferDetails, invoice);
  const acceptance = acceptanceStatus(offerDetails);
  const withdrawn = !!input.applicationWithdrawn;
  const hasAcceptanceDocuments =
    input.hasAcceptanceDocumentsSection ?? structureType !== "existing_contract";
  const hasSigningPackage = input.hasSigningPackage ?? hasAcceptanceDocuments;
  const showLiveAcceptanceDocuments =
    structureType !== "existing_contract" && hasAcceptanceDocuments;
  const showLiveSigning = structureType !== "existing_contract" && hasSigningPackage;
  const envStatus = envelopeStatus(input.signingEnvelopes, offerType, invoice?.id ?? null);
  const contractLock = lockFor(input.sectionLocks, "contract_details");
  const invoiceLock = lockFor(input.sectionLocks, "invoice_details");
  const acceptanceLock = lockFor(input.sectionLocks, "acceptance_documents");
  const sendSection: ReviewSectionId = offerType === "facility" ? "contract_details" : "invoice_details";
  const selectedInvoiceReviewStatus = invoiceReviewStatus(invoices, invoice, input.reviewItems);
  const customerStatus = readSectionStatus(input.sectionStatuses, "contract_details");
  const customerReviewComplete =
    structureType !== "invoice_only" ||
    isCompletedReviewStatus(customerStatus) ||
    OFFER_SENT_OR_LATER.has(entityStatus);
  const invoiceSendLock =
    customerReviewComplete || invoiceLock?.locked
      ? invoiceLock
      : {
          locked: true,
          tooltip: "Approve Customer details first.",
          canManage: true,
        };

  const stages: OfferAcceptanceStage[] = [];

  if (structureType === "existing_contract") {
    stages.push(facilityReferenceStage(input.sourceApplicationDisplayReference));
  }

  if (structureType === "invoice_only") {
    const commercialOfferSent = OFFER_SENT_OR_LATER.has(entityStatus);
    const customerReviewLocked = isWorkflowReviewPresentationLocked(
      withdrawn,
      commercialOfferSent,
      !!contractLock?.locked
    );
    const customerReview = reviewTone(
      customerStatus,
      customerReviewLocked,
      customerReviewLocked ? contractLock?.tooltip : undefined
    );
    stages.push({
      id: "customer_review",
      section: "contract_details",
      title: "Customer review",
      ...customerReview,
      summary:
        commercialOfferSent && isCompletedReviewStatus(customerStatus)
          ? "Customer details reviewed."
          : customerReview.summary,
      tone:
        commercialOfferSent &&
        isCompletedReviewStatus(customerStatus) &&
        customerReview.tone !== "locked"
          ? "done"
          : customerReview.tone,
      tag:
        commercialOfferSent &&
        isCompletedReviewStatus(customerStatus) &&
        customerReview.tone !== "locked"
          ? "Reviewed"
          : customerReview.tag,
    });
  }

  if (structureType === "new_contract") {
    const facilityStatus = readSectionStatus(input.sectionStatuses, "contract_details");
    const workflowComplete = OFFER_SENT_OR_LATER.has(entityStatus);
    const reviewStatus = workflowComplete ? "APPROVED" : facilityStatus;
    const facilityReviewLocked = isWorkflowReviewPresentationLocked(
      withdrawn,
      workflowComplete,
      !!contractLock?.locked
    );
    const facilityReview = reviewTone(
      reviewStatus,
      facilityReviewLocked,
      facilityReviewLocked ? contractLock?.tooltip : undefined
    );
    stages.push({
      id: "facility_review",
      section: "contract_details",
      title: "Facility review",
      ...facilityReview,
      summary: workflowComplete
        ? "Facility details reviewed."
        : facilityReview.summary,
      tone: workflowComplete && facilityReview.tone !== "locked" ? "done" : facilityReview.tone,
      tag: workflowComplete && facilityReview.tone !== "locked" ? "Reviewed" : facilityReview.tag,
    });
  }

  if (structureType !== "new_contract") {
    const itemStatus = selectedInvoiceReviewStatus;
    const reviewStatus = OFFER_SENT_OR_LATER.has(entityStatus) ? "APPROVED" : itemStatus;
    const invoiceReviewLocked = withdrawn || !!invoiceLock?.locked || !customerReviewComplete;
    const invoiceReview = reviewTone(
      invoice ? reviewStatus : "PENDING",
      invoiceReviewLocked,
      invoiceReviewLocked
        ? invoiceLock?.tooltip ||
            (!customerReviewComplete ? "Approve Customer details first." : undefined)
        : undefined
    );
    stages.push({
      id: "invoice_review",
      section: "invoice_details",
      title: "Invoice review",
      ...invoiceReview,
      summary: !invoice
        ? "No invoices submitted."
        : OFFER_SENT_OR_LATER.has(entityStatus)
          ? "Invoice details reviewed."
          : invoiceReview.summary,
      tone:
        !invoice && invoiceReview.tone !== "locked"
          ? "action"
          : OFFER_SENT_OR_LATER.has(entityStatus) && invoiceReview.tone !== "locked"
            ? "done"
            : invoiceReview.tone,
      tag: !invoice
        ? invoiceReview.tone === "locked"
          ? "Locked"
          : "Empty"
        : OFFER_SENT_OR_LATER.has(entityStatus) && invoiceReview.tone !== "locked"
          ? "Reviewed"
          : invoiceReview.tag,
    });
  }

  stages.push(
    sendOfferStage({
      section: sendSection,
      offerType,
      entityStatus,
      reviewItemStatus: offerType === "invoice" ? selectedInvoiceReviewStatus : undefined,
      reviewSectionStatus: offerType === "facility" ? readSectionStatus(input.sectionStatuses, "contract_details") : undefined,
      lock: offerType === "facility" ? contractLock : invoiceSendLock,
      withdrawn,
    })
  );
  stages.push(
    issuerResponseStage({
      section: sendSection,
      offerType,
      entityStatus,
      acceptance,
    })
  );

  if (showLiveAcceptanceDocuments) {
    stages.push(
      acceptanceDocumentsStage({
        lock: withdrawn ? { locked: true, tooltip: "Application withdrawn", canManage: true } : acceptanceLock,
        acceptance,
        entityStatus,
      })
    );
  }
  if (showLiveSigning) {
    stages.push(
      signingPackageStage({
        lock: acceptanceLock,
        acceptance,
        envelopeStatus: envStatus,
        canManageSigning: input.canManageSigning ?? true,
        entityStatus,
        requiresAcceptanceDocuments: hasAcceptanceDocuments,
      })
    );
  }

  if (structureType === "existing_contract") {
    stages.push(inheritedAcceptanceStage(input.sourceApplicationDisplayReference));
  }

  const { currentStageId, nextAction } = nextActionFor(stages);
  return { structureType, offerType, stages, nextAction, currentStageId };
}

/** Stage to expand after Send Offer — Acceptance tab historically, else issuer response. */
export function resolveOfferAcceptanceFocusStageId(
  model: Pick<OfferAcceptanceStageModel, "stages">
): OfferAcceptanceStageId {
  if (model.stages.some((stage) => stage.id === "acceptance_documents")) {
    return "acceptance_documents";
  }
  return "issuer_response";
}

/**
 * When the current workflow stage advances (approve, send, issuer submit, …),
 * close the completed card and open the next one. Other manually expanded cards stay.
 */
export function advanceOpenOfferAcceptanceStages(
  openStageIds: ReadonlySet<OfferAcceptanceStageId>,
  previousCurrentId: OfferAcceptanceStageId,
  nextCurrentId: OfferAcceptanceStageId
): Set<OfferAcceptanceStageId> {
  const next = new Set(openStageIds);
  if (previousCurrentId !== nextCurrentId) {
    next.delete(previousCurrentId);
  }
  next.add(nextCurrentId);
  return next;
}
