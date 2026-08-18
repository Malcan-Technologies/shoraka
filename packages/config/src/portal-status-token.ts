import type { UserPortalStatusToken } from "./status-badges";

const NEUTRAL_STATUSES = new Set([
  "DRAFT",
  "ARCHIVED",
  "INACTIVE",
  "NOT_STARTED",
  "NOT_OPENED",
  "NOT_OPEN",
  "CLOSED",
  "UNPUBLISHED",
  "RELEASED",
  "REFUNDED",
  "CANCELLED",
  "WITHDRAWN",
]);

const SUCCESS_STATUSES = new Set([
  "COMPLETED",
  "APPROVED",
  "RECEIVED",
  "RECONCILED",
  "SETTLED",
  "VERIFIED",
  "ACCEPTED",
  "SIGNED",
  "STAMPED",
  "GENERATED",
  "REPAID",
]);

const ACTIVE_STATUSES = new Set(["ACTIVE", "CONFIRMED"]);

const REJECTED_STATUSES = new Set([
  "REJECTED",
  "FAILED",
  "FAILED_FUNDING",
  "DEFAULTED",
  "DECLINED",
  "HELD",
  "ARREARS",
  "VOIDED",
  "VOID",
  "EXPIRED",
  "OFFER_EXPIRED",
]);

/** Yellow — you (issuer/investor) must act. Inverse of admin waiting-on-others. */
const YOUR_ACTION_STATUSES = new Set([
  "OFFER_SENT",
  "CONTRACT_SENT",
  "INVOICES_SENT",
  "AMENDMENT_REQUESTED",
  "PENDING_AMENDMENT",
  "PENDING_ISSUER",
  "CHANGES_REQUESTED",
  "SENT",
  "IN_PROGRESS",
  "SIGNING_IN_PROGRESS",
]);

/** Blue — waiting on CashSouk, trustee, or another party. Inverse of admin-must-act. */
const WAITING_ON_OTHERS_STATUSES = new Set([
  "PENDING",
  "SUBMITTED",
  "RESUBMITTED",
  "UNDER_REVIEW",
  "CONTRACT_PENDING",
  "INVOICE_PENDING",
  "CONTRACT_ACCEPTED",
  "INVOICE_ACCEPTED",
  "SIGNING_PENDING",
  "PENDING_APPROVAL",
  "PENDING_AML",
  "PENDING_SSM_REVIEW",
  "PENDING_FINAL_APPROVAL",
  "PENDING_ADMIN_REVIEW",
  "APPROVED_FOR_SIGNING",
  "PAID",
  "FUNDED",
  "FUNDING",
  "VIEWED",
  "OPEN",
  "OPENED",
  "PUBLISHED",
  "CREATED",
]);

/**
 * Issuer/investor workflow colours (viewer-centric):
 * yellow (action) = you must act
 * blue (submitted) = waiting on CashSouk or another party
 * violet (active) = live / in force
 * green (success) = completed / approved / final positive
 * grey (neutral) = draft / idle / withdrawn
 * red (rejected) = failed / declined / expired / arrears
 */
export function getUserPortalStatusToken(status: string): UserPortalStatusToken {
  const key = String(status ?? "").trim().toUpperCase();
  if (!key) return "neutral";
  if (NEUTRAL_STATUSES.has(key)) return "neutral";
  if (ACTIVE_STATUSES.has(key)) return "active";
  if (SUCCESS_STATUSES.has(key)) return "success";
  if (REJECTED_STATUSES.has(key)) return "rejected";
  if (YOUR_ACTION_STATUSES.has(key)) return "action";
  if (WAITING_ON_OTHERS_STATUSES.has(key)) return "submitted";

  if (
    key.includes("SENT") ||
    key.includes("REQUESTED") ||
    key.includes("AMENDMENT") ||
    key.includes("ISSUER")
  ) {
    return "action";
  }

  if (
    key.includes("PENDING") ||
    key.includes("PROGRESS") ||
    key.includes("SUBMIT") ||
    key.includes("REVIEW") ||
    key.includes("WAITING") ||
    key.includes("AWAIT")
  ) {
    return "submitted";
  }

  return "neutral";
}

/**
 * Organization onboarding chip (issuer + investor org switcher).
 * Yellow = you must continue; blue = waiting on CashSouk; purple is reserved for live notes.
 */
export function onboardingStatusToToken(
  status: string,
  regtankStatus?: string | null
): UserPortalStatusToken {
  const org = String(status ?? "").toUpperCase();
  const regtank = String(regtankStatus ?? "").toUpperCase();

  if (regtank === "EXPIRED" || org === "REJECTED" || regtank === "REJECTED") {
    return "rejected";
  }
  if (org === "COMPLETED") return "success";
  if (org === "PENDING_AMENDMENT") return "action";
  if (
    org === "PENDING_AML" ||
    org === "PENDING_FINAL_APPROVAL" ||
    org === "PENDING_SSM_REVIEW" ||
    org === "PENDING_APPROVAL" ||
    org === "IN_PROGRESS" ||
    regtank === "PENDING_APPROVAL" ||
    regtank === "IN_PROGRESS" ||
    regtank === "FORM_FILLING" ||
    regtank === "LIVENESS_STARTED"
  ) {
    return "submitted";
  }
  if (org === "PENDING") return "action";
  return getUserPortalStatusToken(org || regtank);
}

export function onboardingStatusLabel(
  status: string,
  regtankStatus?: string | null
): string {
  const org = String(status ?? "").toUpperCase();
  const regtank = String(regtankStatus ?? "").toUpperCase();

  if (org === "COMPLETED") return "Verified";
  if (org === "REJECTED" || regtank === "REJECTED") return "Rejected";
  if (org === "PENDING_AML") return "Pending AML Approval";
  if (org === "PENDING_AMENDMENT") return "Amendment in Progress";
  if (org === "PENDING_FINAL_APPROVAL") return "Pending Final Approval";
  if (regtank === "EXPIRED") return "Expired";
  if (regtank === "PENDING_APPROVAL" || org === "PENDING_APPROVAL") return "Pending Approval";
  if (org === "IN_PROGRESS") return "In Progress";
  if (
    regtank === "IN_PROGRESS" ||
    regtank === "FORM_FILLING" ||
    regtank === "LIVENESS_STARTED"
  ) {
    return "Pending";
  }
  return "Pending";
}

export function isOnboardingVerified(
  status: string,
  regtankStatus?: string | null
): boolean {
  return onboardingStatusLabel(status, regtankStatus) === "Verified";
}

const ONBOARDING_TOKEN_SURFACE: Record<UserPortalStatusToken, string> = {
  action: "bg-status-action-bg text-status-action-text",
  submitted: "bg-status-submitted-bg text-status-submitted-text",
  success: "bg-status-success-bg text-status-success-text",
  active: "bg-status-active-bg text-status-active-text",
  rejected: "bg-status-rejected-bg text-status-rejected-text",
  neutral: "bg-status-neutral-bg text-status-neutral-text",
};

/** Org-switcher avatar wash — same tokens as the onboarding chip. */
export function onboardingActionIconClass(
  status: string,
  regtankStatus?: string | null
): string {
  return ONBOARDING_TOKEN_SURFACE[onboardingStatusToToken(status, regtankStatus)];
}
