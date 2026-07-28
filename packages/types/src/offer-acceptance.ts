/**
 * Offer-acceptance phase (Option A): status lives on offer_details.offer_acceptance.
 * Step 1 is upload-only via product acceptance_documents.
 * See docs/guides/application-flow/offer-acceptance-and-signing-phases.md
 */

import { getStepKeyFromStepId } from "./application-steps";
import {
  ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY,
  resolveAcceptanceDocumentsFromWorkflow,
  workflowHasAcceptanceDocuments,
} from "./acceptance-documents";
import {
  ACCEPTANCE_DEADLINE_WORKFLOW_KEY,
  DEFAULT_ACCEPTANCE_DEADLINE,
  DEFAULT_SIGNING_DEADLINE,
  parsePhaseDeadlineConfig,
  serializePhaseDeadlineConfig,
  SIGNING_DEADLINE_WORKFLOW_KEY,
  type PhaseDeadlineConfig,
} from "./deadline-config";

export {
  ACCEPTANCE_DEADLINE_WORKFLOW_KEY,
  SIGNING_DEADLINE_WORKFLOW_KEY,
  DEFAULT_ACCEPTANCE_DEADLINE,
  DEFAULT_SIGNING_DEADLINE,
};
export type { PhaseDeadlineConfig };

export type OfferAcceptanceStatus =
  | "PENDING_ISSUER"
  | "PENDING_ADMIN_REVIEW"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "DECLINED"
  | "APPROVED_FOR_SIGNING"
  | "SIGNING_IN_PROGRESS"
  | "COMPLETED";

export const OFFER_ACCEPTANCE_STATUSES: readonly OfferAcceptanceStatus[] = [
  "PENDING_ISSUER",
  "PENDING_ADMIN_REVIEW",
  "CHANGES_REQUESTED",
  "REJECTED",
  "DECLINED",
  "APPROVED_FOR_SIGNING",
  "SIGNING_IN_PROGRESS",
  "COMPLETED",
] as const;

/**
 * Frozen commercial terms at Step 1 submit — audit/display only; not used for pricing.
 * Shape is a union of contract + invoice fields present on the offer at submit time.
 */
export type OfferAcknowledgedTermsSnapshot = {
  offer_version: number;
  product_version: number | null;
  /** Acceptance clock deadline frozen at Step 1 (from offer_acceptance.acceptance_expires_at). */
  expires_at: string | null;
  offered_facility?: number;
  facility_fee_rate_percent?: number | null;
  offered_amount?: number;
  offered_ratio_percent?: number | null;
  offered_profit_rate_percent?: number | null;
  platform_fee_rate_percent?: number | null;
  risk_rating?: string | null;
};

export type OfferAcceptanceDetails = {
  status: OfferAcceptanceStatus;
  /** Set on Step 1 submit; proves which commercial numbers were acknowledged. */
  acknowledged_terms?: OfferAcknowledgedTermsSnapshot;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
  /** Stamp on Send Offer from product acceptance_deadline.days. */
  acceptance_expires_at?: string | null;
  /** Stamp when entering APPROVED_FOR_SIGNING from product signing_deadline.days. */
  signing_expires_at?: string | null;
  /** Idempotency map: e.g. "acceptance:1" → ISO sent_at. */
  deadline_reminders_sent?: Record<string, string>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isOfferAcceptanceStatus(value: unknown): value is OfferAcceptanceStatus {
  return typeof value === "string" && OFFER_ACCEPTANCE_STATUSES.includes(value as OfferAcceptanceStatus);
}

export function parseOfferAcceptanceDetails(value: unknown): OfferAcceptanceDetails | null {
  const root = asRecord(value);
  if (!root) return null;
  if (!isOfferAcceptanceStatus(root.status)) return null;
  const acknowledgedTerms = parseAcknowledgedTermsSnapshot(root.acknowledged_terms);
  const remindersSent = asRecord(root.deadline_reminders_sent);
  const deadlineRemindersSent: Record<string, string> | undefined = remindersSent
    ? Object.fromEntries(
        Object.entries(remindersSent).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0
        )
      )
    : undefined;
  return {
    status: root.status,
    ...(acknowledgedTerms ? { acknowledged_terms: acknowledgedTerms } : {}),
    submitted_at: typeof root.submitted_at === "string" ? root.submitted_at : root.submitted_at === null ? null : undefined,
    reviewed_at: typeof root.reviewed_at === "string" ? root.reviewed_at : root.reviewed_at === null ? null : undefined,
    reviewed_by_user_id:
      typeof root.reviewed_by_user_id === "string"
        ? root.reviewed_by_user_id
        : root.reviewed_by_user_id === null
          ? null
          : undefined,
    acceptance_expires_at:
      typeof root.acceptance_expires_at === "string"
        ? root.acceptance_expires_at
        : root.acceptance_expires_at === null
          ? null
          : undefined,
    signing_expires_at:
      typeof root.signing_expires_at === "string"
        ? root.signing_expires_at
        : root.signing_expires_at === null
          ? null
          : undefined,
    ...(deadlineRemindersSent && Object.keys(deadlineRemindersSent).length > 0
      ? { deadline_reminders_sent: deadlineRemindersSent }
      : {}),
  };
}

function parseOptionalFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseOptionalNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return parseOptionalFiniteNumber(value);
}

export function parseAcknowledgedTermsSnapshot(
  value: unknown
): OfferAcknowledgedTermsSnapshot | null {
  const root = asRecord(value);
  if (!root) return null;
  const offerVersion = parseOptionalFiniteNumber(root.offer_version);
  if (offerVersion == null) return null;
  const productVersion =
    root.product_version === null
      ? null
      : (parseOptionalFiniteNumber(root.product_version) ?? null);
  const expiresAt =
    typeof root.expires_at === "string"
      ? root.expires_at
      : root.expires_at === null
        ? null
        : null;
  const snapshot: OfferAcknowledgedTermsSnapshot = {
    offer_version: offerVersion,
    product_version: productVersion,
    expires_at: expiresAt,
  };
  const offeredFacility = parseOptionalFiniteNumber(root.offered_facility);
  if (offeredFacility != null) snapshot.offered_facility = offeredFacility;
  const facilityFee = parseOptionalNullableNumber(root.facility_fee_rate_percent);
  if (facilityFee !== undefined) snapshot.facility_fee_rate_percent = facilityFee;
  const offeredAmount = parseOptionalFiniteNumber(root.offered_amount);
  if (offeredAmount != null) snapshot.offered_amount = offeredAmount;
  const offeredRatio = parseOptionalNullableNumber(root.offered_ratio_percent);
  if (offeredRatio !== undefined) snapshot.offered_ratio_percent = offeredRatio;
  const offeredProfit = parseOptionalNullableNumber(root.offered_profit_rate_percent);
  if (offeredProfit !== undefined) snapshot.offered_profit_rate_percent = offeredProfit;
  const platformFee = parseOptionalNullableNumber(root.platform_fee_rate_percent);
  if (platformFee !== undefined) snapshot.platform_fee_rate_percent = platformFee;
  if (typeof root.risk_rating === "string") {
    snapshot.risk_rating = root.risk_rating;
  } else if (root.risk_rating === null) {
    snapshot.risk_rating = null;
  }
  return snapshot;
}

/**
 * Copy commercial fields from current offer_details for Step 1 audit snapshot.
 * Display/audit only — callers must not use this to drive pricing.
 */
export function buildAcknowledgedTermsSnapshot(params: {
  offerDetails: Record<string, unknown>;
  productVersion: number | null | undefined;
}): OfferAcknowledgedTermsSnapshot {
  const offer = params.offerDetails;
  const offerVersion = parseOptionalFiniteNumber(offer.version) ?? 0;
  const acceptance = parseOfferAcceptanceDetails(offer.offer_acceptance);
  const expiresAt =
    typeof acceptance?.acceptance_expires_at === "string"
      ? acceptance.acceptance_expires_at
      : null;
  const snapshot: OfferAcknowledgedTermsSnapshot = {
    offer_version: offerVersion,
    product_version:
      params.productVersion != null && Number.isFinite(params.productVersion)
        ? params.productVersion
        : null,
    expires_at: expiresAt,
  };
  const offeredFacility = parseOptionalFiniteNumber(offer.offered_facility);
  if (offeredFacility != null) snapshot.offered_facility = offeredFacility;
  const facilityFee = parseOptionalNullableNumber(offer.facility_fee_rate_percent);
  if (facilityFee !== undefined) snapshot.facility_fee_rate_percent = facilityFee;
  const offeredAmount = parseOptionalFiniteNumber(offer.offered_amount);
  if (offeredAmount != null) snapshot.offered_amount = offeredAmount;
  const offeredRatio = parseOptionalNullableNumber(offer.offered_ratio_percent);
  if (offeredRatio !== undefined) snapshot.offered_ratio_percent = offeredRatio;
  const offeredProfit = parseOptionalNullableNumber(offer.offered_profit_rate_percent);
  if (offeredProfit !== undefined) snapshot.offered_profit_rate_percent = offeredProfit;
  const platformFee = parseOptionalNullableNumber(offer.platform_fee_rate_percent);
  if (platformFee !== undefined) snapshot.platform_fee_rate_percent = platformFee;
  if (typeof offer.risk_rating === "string") {
    snapshot.risk_rating = offer.risk_rating;
  } else if (offer.risk_rating === null) {
    snapshot.risk_rating = null;
  }
  return snapshot;
}

/**
 * True when admin must retract before sending a new offer version.
 * Absent acceptance (legacy) or PENDING_ISSUER with no submitted_at → re-send allowed.
 */
export function isOfferAcceptanceResendBlocked(
  acceptance: OfferAcceptanceDetails | null | undefined
): boolean {
  if (!acceptance) return false;
  if (acceptance.status !== "PENDING_ISSUER") return true;
  if (typeof acceptance.submitted_at === "string" && acceptance.submitted_at.length > 0) {
    return true;
  }
  return false;
}

/**
 * Admin Acceptance documents list: only after issuer Submit (not draft uploads while PENDING_ISSUER).
 * Uses submitted_at when present; otherwise any post-submit / terminal phase status.
 */
export function isOfferAcceptanceDocumentsVisibleToAdmin(
  acceptance: OfferAcceptanceDetails | null | undefined
): boolean {
  if (!acceptance) return false;
  if (typeof acceptance.submitted_at === "string" && acceptance.submitted_at.length > 0) {
    return true;
  }
  switch (acceptance.status) {
    case "PENDING_ADMIN_REVIEW":
    case "CHANGES_REQUESTED":
    case "APPROVED_FOR_SIGNING":
    case "SIGNING_IN_PROGRESS":
    case "COMPLETED":
    case "REJECTED":
    case "DECLINED":
      return true;
    default:
      return false;
  }
}

/** Read offer_acceptance from a contract/invoice offer_details blob. */
export function getOfferAcceptanceFromOfferDetails(
  offerDetails: unknown
): OfferAcceptanceDetails | null {
  const root = asRecord(offerDetails);
  if (!root) return null;
  return parseOfferAcceptanceDetails(root.offer_acceptance);
}

export function createInitialOfferAcceptanceDetails(
  overrides?: Partial<Pick<OfferAcceptanceDetails, "acceptance_expires_at">>
): OfferAcceptanceDetails {
  return {
    status: "PENDING_ISSUER",
    ...(overrides?.acceptance_expires_at != null
      ? { acceptance_expires_at: overrides.acceptance_expires_at }
      : {}),
  };
}

/** Merge offer_acceptance into an offer_details object (shallow). */
export function withOfferAcceptance(
  offerDetails: Record<string, unknown>,
  acceptance: OfferAcceptanceDetails
): Record<string, unknown> {
  return { ...offerDetails, offer_acceptance: acceptance };
}

/** Issuer UI: signing steps are visible after admin approval (including completed packages). */
export function offerAcceptanceAllowsSigning(status: OfferAcceptanceStatus | null | undefined): boolean {
  return status === "APPROVED_FOR_SIGNING" || status === "SIGNING_IN_PROGRESS" || status === "COMPLETED";
}

/** Create a draft signing package only from the approved-for-signing phase. */
export function offerAcceptanceAllowsCreateSigningPackage(
  status: OfferAcceptanceStatus | null | undefined
): boolean {
  return status === "APPROVED_FOR_SIGNING";
}

/** Send (or re-send after draft) while approved or already marked signing-in-progress. */
export function offerAcceptanceAllowsSendSigningPackage(
  status: OfferAcceptanceStatus | null | undefined
): boolean {
  return status === "APPROVED_FOR_SIGNING" || status === "SIGNING_IN_PROGRESS";
}

export function offerAcceptanceIsStep1Editable(status: OfferAcceptanceStatus | null | undefined): boolean {
  return status === "PENDING_ISSUER" || status === "CHANGES_REQUESTED" || status == null;
}

export function offerAcceptanceIsTerminal(status: OfferAcceptanceStatus | null | undefined): boolean {
  return status === "REJECTED" || status === "DECLINED" || status === "COMPLETED";
}

export function offerAcceptanceIsAwaitingAdmin(status: OfferAcceptanceStatus | null | undefined): boolean {
  return status === "PENDING_ADMIN_REVIEW";
}

/**
 * Whether the issuer Review Offer CTA should show for this acceptance phase.
 * Hidden while waiting on admin (`PENDING_ADMIN_REVIEW`); legacy offers (no status) keep the CTA.
 */
export function offerAcceptanceAllowsIssuerReviewCta(
  status: OfferAcceptanceStatus | null | undefined
): boolean {
  if (status == null) return true;
  return (
    status === "PENDING_ISSUER" ||
    status === "CHANGES_REQUESTED" ||
    status === "APPROVED_FOR_SIGNING" ||
    status === "SIGNING_IN_PROGRESS"
  );
}

function findFinancingTypeConfig(workflow: unknown): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  for (const step of workflow) {
    const sid = String((step as { id?: unknown })?.id ?? "");
    if (getStepKeyFromStepId(sid) !== "financing_type") continue;
    return asRecord((step as { config?: unknown }).config);
  }
  return null;
}

export function parseAcceptanceDeadlineConfig(financingConfig: unknown): PhaseDeadlineConfig | null {
  const config = asRecord(financingConfig) ?? {};
  return parsePhaseDeadlineConfig(config[ACCEPTANCE_DEADLINE_WORKFLOW_KEY]);
}

export function writeAcceptanceDeadlineConfig(
  financingConfig: Record<string, unknown>,
  deadline: PhaseDeadlineConfig
): Record<string, unknown> {
  return {
    ...financingConfig,
    [ACCEPTANCE_DEADLINE_WORKFLOW_KEY]: serializePhaseDeadlineConfig(deadline),
  };
}

export function parseSigningDeadlineConfig(financingConfig: unknown): PhaseDeadlineConfig | null {
  const config = asRecord(financingConfig) ?? {};
  return parsePhaseDeadlineConfig(config[SIGNING_DEADLINE_WORKFLOW_KEY]);
}

export function writeSigningDeadlineConfig(
  financingConfig: Record<string, unknown>,
  deadline: PhaseDeadlineConfig
): Record<string, unknown> {
  return {
    ...financingConfig,
    [SIGNING_DEADLINE_WORKFLOW_KEY]: serializePhaseDeadlineConfig(deadline),
  };
}

export function resolveAcceptanceDeadlineFromWorkflow(workflow: unknown): PhaseDeadlineConfig | null {
  return parseAcceptanceDeadlineConfig(findFinancingTypeConfig(workflow));
}

export function resolveSigningDeadlineFromWorkflow(workflow: unknown): PhaseDeadlineConfig | null {
  return parseSigningDeadlineConfig(findFinancingTypeConfig(workflow));
}

/** Active deadline for issuer display / soft expiry while OFFER_SENT. */
export function resolveActiveOfferDeadlineIso(
  acceptance: OfferAcceptanceDetails | null | undefined
): string | null {
  if (!acceptance) return null;
  if (
    acceptance.status === "APPROVED_FOR_SIGNING" ||
    acceptance.status === "SIGNING_IN_PROGRESS"
  ) {
    return typeof acceptance.signing_expires_at === "string" ? acceptance.signing_expires_at : null;
  }
  // Acceptance clock pauses while CashSouk reviews (PENDING_ADMIN_REVIEW).
  if (acceptance.status === "PENDING_ISSUER" || acceptance.status === "CHANGES_REQUESTED") {
    return typeof acceptance.acceptance_expires_at === "string"
      ? acceptance.acceptance_expires_at
      : null;
  }
  return null;
}

/**
 * True when the product uses the phased accept → admin review → signing flow.
 * Requires acceptance_documents on the financing-type step.
 */
export function workflowUsesOfferAcceptanceFlow(workflow: unknown): boolean {
  return workflowHasAcceptanceDocuments(workflow);
}

/**
 * After Step 1 submit: if there are acceptance docs to review, wait for admin;
 * otherwise unlock signing immediately.
 */
export function resolveStatusAfterOfferAcceptanceSubmit(workflow: unknown): OfferAcceptanceStatus {
  return resolveAcceptanceDocumentsFromWorkflow(workflow).length > 0
    ? "PENDING_ADMIN_REVIEW"
    : "APPROVED_FOR_SIGNING";
}

export type OfferAcceptanceStatusPresentation = {
  label: string;
  /** Short hint for admin / issuer banners */
  hint: string;
};

export function getOfferAcceptanceStatusPresentation(
  status: OfferAcceptanceStatus
): OfferAcceptanceStatusPresentation {
  switch (status) {
    case "PENDING_ISSUER":
      return { label: "Pending issuer", hint: "Issuer must upload acceptance documents." };
    case "PENDING_ADMIN_REVIEW":
      return { label: "Pending admin review", hint: "Review acceptance documents before signing can start." };
    case "CHANGES_REQUESTED":
      return { label: "Changes requested", hint: "Issuer must update acceptance documents and resubmit." };
    case "REJECTED":
      return { label: "Acceptance rejected", hint: "Offer was withdrawn after acceptance was rejected." };
    case "DECLINED":
      return { label: "Offer declined", hint: "Issuer declined this offer; acceptance and signing are closed." };
    case "APPROVED_FOR_SIGNING":
      return { label: "Approved for signing", hint: "Issuer can configure signers and send the signing package." };
    case "SIGNING_IN_PROGRESS":
      return { label: "Signing in progress", hint: "Signing package has been sent." };
    case "COMPLETED":
      return { label: "Completed", hint: "Signing package completed; offer accepted." };
  }
}

/** Re-export key for product validation with acceptance docs. */
export { ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY };
