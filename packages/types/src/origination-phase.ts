/**
 * Computed origination phase — not stored in DB.
 * Single source for withdraw / archive / reject / reset-to-pending guards.
 */

export type OriginationPhase =
  | "draft"
  | "underReview"
  | "amendment"
  | "offerLive"
  | "signing"
  | "approved"
  | "closed"
  | "expired";

const CLOSED_APPLICATION_STATUSES = new Set<string>([
  "COMPLETED",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED",
]);

const SIGNING_APPLICATION_STATUSES = new Set<string>([
  "CONTRACT_ACCEPTED",
  "INVOICE_ACCEPTED",
  "SIGNING_PENDING",
]);

const OFFER_LIVE_APPLICATION_STATUSES = new Set<string>([
  "CONTRACT_SENT",
  "INVOICES_SENT",
]);

const ENTITY_OFFER_LIVE_STATUSES = new Set<string>(["OFFER_SENT", "OFFER_EXPIRED"]);

const ENTITY_BOOKED_STATUSES = new Set<string>(["APPROVED"]);

const TERMINAL_ENVELOPE_STATUSES = new Set<string>(["COMPLETED"]);

/** Application statuses handled explicitly by {@link resolveOriginationPhase}. */
const RECOGNIZED_APPLICATION_STATUSES = new Set<string>([
  "DRAFT",
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
  "AMENDMENT_REQUESTED",
  "RESUBMITTED",
  "COMPLETED",
  "WITHDRAWN",
  "REJECTED",
  "ARCHIVED",
]);

export type OriginationPhaseInput = {
  applicationStatus: string;
  contractStatus?: string | null;
  /** All invoice statuses on the application. */
  invoiceStatuses?: readonly string[];
  /** Primary offer acceptance phase (contract or invoice-only offer). */
  offerAcceptanceStatus?: string | null;
  /** Signing envelope statuses linked to the application (any target). */
  signingEnvelopeStatuses?: readonly string[];
};

function norm(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase();
}

function hasEntityOfferLive(input: OriginationPhaseInput): boolean {
  const contract = norm(input.contractStatus);
  if (contract && ENTITY_OFFER_LIVE_STATUSES.has(contract)) {
    return true;
  }
  return (input.invoiceStatuses ?? []).some((status) =>
    ENTITY_OFFER_LIVE_STATUSES.has(norm(status))
  );
}

function hasEntityApproved(input: OriginationPhaseInput): boolean {
  const contract = norm(input.contractStatus);
  if (contract && ENTITY_BOOKED_STATUSES.has(contract)) {
    return true;
  }
  return (input.invoiceStatuses ?? []).some((status) =>
    ENTITY_BOOKED_STATUSES.has(norm(status))
  );
}

function hasCompletedSigningEnvelope(input: OriginationPhaseInput): boolean {
  return (input.signingEnvelopeStatuses ?? []).some((status) =>
    TERMINAL_ENVELOPE_STATUSES.has(norm(status))
  );
}

/**
 * Derive the current origination phase from application + child entity signals.
 * Most specific operational phase wins (approved before signing, etc.).
 */
export function resolveOriginationPhase(input: OriginationPhaseInput): OriginationPhase {
  const app = norm(input.applicationStatus);
  const acceptance = norm(input.offerAcceptanceStatus);

  if (app === "DRAFT") {
    return "draft";
  }
  if (CLOSED_APPLICATION_STATUSES.has(app)) {
    return "closed";
  }
  if (app === "AMENDMENT_REQUESTED") {
    return "amendment";
  }
  if (app === "OFFER_EXPIRED") {
    return "expired";
  }

  if (hasEntityApproved(input) || hasCompletedSigningEnvelope(input)) {
    return "approved";
  }

  if (
    SIGNING_APPLICATION_STATUSES.has(app) ||
    acceptance === "SIGNING_IN_PROGRESS" ||
    acceptance === "APPROVED_FOR_SIGNING"
  ) {
    return "signing";
  }

  if (OFFER_LIVE_APPLICATION_STATUSES.has(app) || hasEntityOfferLive(input)) {
    return "offerLive";
  }

  if (!RECOGNIZED_APPLICATION_STATUSES.has(app)) {
    return "closed";
  }

  return "underReview";
}

export function canWithdrawApplication(phase: OriginationPhase): boolean {
  return (
    phase === "underReview" ||
    phase === "amendment" ||
    phase === "offerLive" ||
    phase === "signing" ||
    phase === "expired"
  );
}

export function canArchiveApplication(
  phase: OriginationPhase,
  options?: { alreadyArchived?: boolean }
): boolean {
  if (options?.alreadyArchived) {
    return false;
  }
  return phase === "draft" || phase === "closed";
}

/** Issuer list hides draft ARCHIVED status and closed files with archived_at set. */
export function isApplicationHiddenFromIssuerList(application: {
  status: string;
  archivedAt?: string | Date | null;
  archived_at?: string | Date | null;
}): boolean {
  const archivedAt = application.archivedAt ?? application.archived_at ?? null;
  return norm(application.status) === "ARCHIVED" || archivedAt != null;
}

/** User-facing copy when issuer withdraw is disabled. */
export function issuerWithdrawBlockedMessage(
  phase: OriginationPhase,
  options?: { facilityInForceNoInvoices?: boolean }
): string | null {
  if (canWithdrawApplication(phase)) {
    return null;
  }
  if (phase === "closed") {
    return "This application can no longer be withdrawn.";
  }
  if (phase === "approved" || options?.facilityInForceNoInvoices) {
    return "Withdraw is not available after the facility or invoice has been approved.";
  }
  return "This application can no longer be withdrawn.";
}

export function canRejectApplication(phase: OriginationPhase): boolean {
  return (
    phase === "underReview" ||
    phase === "amendment" ||
    phase === "offerLive" ||
    phase === "signing" ||
    phase === "expired"
  );
}

/**
 * Under review/amendment: always. Signing: only when every active envelope is DRAFT (or none).
 */
export function canResetReviewToPending(
  phase: OriginationPhase,
  options?: { signingEnvelopesOnlyDraft?: boolean }
): boolean {
  if (phase === "underReview" || phase === "amendment") {
    return true;
  }
  if (phase === "offerLive") {
    return false;
  }
  if (phase === "signing") {
    return options?.signingEnvelopesOnlyDraft === true;
  }
  return false;
}

/** Facility approved but every invoice declined/withdrawn — still COMPLETED, not a financed drawdown. */
export function isCompletedWithNoApprovedInvoices(
  applicationStatus: string,
  invoiceStatuses: readonly string[]
): boolean {
  if (norm(applicationStatus) !== "COMPLETED") {
    return false;
  }
  if (invoiceStatuses.length === 0) {
    return false;
  }
  return !invoiceStatuses.some((status) => norm(status) === "APPROVED");
}

export function buildOriginationPhaseInput(params: {
  applicationStatus: string;
  contract?: { status?: string | null } | null;
  invoices?: Array<{ status?: string | null }>;
  offerAcceptanceStatus?: string | null;
  signingEnvelopes?: Array<{ status?: string | null }>;
}): OriginationPhaseInput {
  return {
    applicationStatus: params.applicationStatus,
    contractStatus: params.contract?.status ? norm(params.contract.status) : null,
    invoiceStatuses: (params.invoices ?? []).map((invoice) => norm(invoice.status)),
    offerAcceptanceStatus: params.offerAcceptanceStatus
      ? norm(params.offerAcceptanceStatus)
      : null,
    signingEnvelopeStatuses: (params.signingEnvelopes ?? []).map((envelope) =>
      norm(envelope.status)
    ),
  };
}
