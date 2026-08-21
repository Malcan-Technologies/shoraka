import type { DirectorShareholderFinalStatusTone } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";

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

/** Violet — live / in force (including investment Confirmed, before Settled). */
const ACTIVE_STATUSES = new Set(["ACTIVE", "CONFIRMED"]);

const REJECTED_STATUSES = new Set([
  "REJECTED",
  "FAILED",
  "FAILED_FUNDING",
  "DEFAULTED",
  "DECLINED",
  "WITHDRAWN",
  "HELD",
  "ARREARS",
  "VOIDED",
  "VOID",
  "EXPIRED",
  "OFFER_EXPIRED",
]);

/** Yellow — CashSouk admin needs to act. */
const ADMIN_ACTION_STATUSES = new Set([
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
  "NAME_CHECK_PENDING",
  "LETTER_GENERATED",
  "FUNDED",
  "FUNDING",
  "VIEWED",
  "RUNNING",
]);

/** Blue — waiting on issuer, investor, signers, trustee, or a payment rail. */
const WAITING_ON_OTHERS_STATUSES = new Set([
  "OFFER_SENT",
  "CONTRACT_SENT",
  "INVOICES_SENT",
  "AMENDMENT_REQUESTED",
  "PENDING_AMENDMENT",
  "PENDING_ISSUER",
  "CHANGES_REQUESTED",
  "PENDING_ONBOARDING",
  "IN_PROGRESS",
  "SIGNING_IN_PROGRESS",
  "SENT",
  "CREATED",
  "PUBLISHED",
  "OPEN",
  "OPENED",
  "COMMITTED",
  "PARTIAL",
  "SUBMITTED_TO_TRUSTEE",
  "REFUND_INITIATED",
]);

/**
 * Admin table status colours (viewer-centric for operations):
 * yellow (action) = admin must act
 * blue (submitted) = waiting on someone else
 * violet (active) = live / in force
 * green (success) = completed / approved / final positive
 * grey (neutral) = draft / idle / closed
 * red (rejected) = failed / declined / expired / arrears
 */
export function getAdminStatusToken(status: string): StatusToken {
  const key = String(status ?? "").trim().toUpperCase();
  if (!key) return "neutral";
  if (NEUTRAL_STATUSES.has(key)) return "neutral";
  if (ACTIVE_STATUSES.has(key)) return "active";
  if (SUCCESS_STATUSES.has(key)) return "success";
  if (REJECTED_STATUSES.has(key)) return "rejected";
  if (ADMIN_ACTION_STATUSES.has(key)) return "action";
  if (WAITING_ON_OTHERS_STATUSES.has(key)) return "submitted";

  if (
    key.includes("SENT") ||
    key.includes("REQUESTED") ||
    key.includes("WAITING") ||
    key.includes("AWAIT") ||
    key.includes("ISSUER")
  ) {
    return "submitted";
  }

  if (
    key.includes("PENDING") ||
    key.includes("PROGRESS") ||
    key.includes("SUBMIT") ||
    key.includes("REVIEW")
  ) {
    return "action";
  }

  return "neutral";
}

/** Subtle yellow section wash for admin-action surfaces (banners, detail cards). */
export const ADMIN_ACTION_SURFACE_CLASS =
  "border-status-action-text/15 bg-[hsl(var(--status-action-bg)/0.45)]";

/** Subtle blue section wash when waiting on issuer, investor, or trustee. */
export const ADMIN_WAITING_SURFACE_CLASS =
  "border-status-submitted-text/15 bg-[hsl(var(--status-submitted-bg)/0.45)]";

/** Subtle yellow row wash — same 45% action fill as dashboard next-to-do tiles. */
export const ADMIN_ACTION_ROW_CLASS =
  "bg-[hsl(var(--status-action-bg)/0.45)] hover:bg-[hsl(var(--status-action-bg)/0.45)] odd:bg-[hsl(var(--status-action-bg)/0.45)]";

/**
 * Status modifier for the shared entity-hero wash (gradient + lattice).
 * Color comes from the badge text token so the card stays lighter than the chip.
 */
export function adminHeroTintClass(token: StatusToken): string {
  return `admin-hero-tint-${token}`;
}

/** Subtle red row wash for arrears / failed notes — same 45% fill as action rows. */
export const ADMIN_REJECTED_ROW_CLASS =
  "bg-[hsl(var(--status-rejected-bg)/0.45)] hover:bg-[hsl(var(--status-rejected-bg)/0.45)] odd:bg-[hsl(var(--status-rejected-bg)/0.45)]";

/** Tab-dot priority: admin work, then waiting, then live, then finished. */
export const ADMIN_TAB_TOKEN_PRIORITY: StatusToken[] = [
  "action",
  "submitted",
  "active",
  "success",
  "rejected",
];

export function pickHighestAdminTabToken(
  tokens: Iterable<StatusToken>,
  fallback: StatusToken = "neutral"
): StatusToken {
  const set = tokens instanceof Set ? tokens : new Set(tokens);
  if (set.size === 0) return fallback;
  return ADMIN_TAB_TOKEN_PRIORITY.find((token) => set.has(token)) ?? fallback;
}

export function adminTabStatusLabel(token: StatusToken): string {
  switch (token) {
    case "action":
      return "Needs action";
    case "submitted":
      return "Waiting";
    case "active":
      return "Live";
    case "success":
      return "Done";
    case "rejected":
      return "Closed";
    default:
      return "Not started";
  }
}

export function adminActionRowClass(tokenOrNeedsAction: StatusToken | boolean): string {
  const needsAction =
    typeof tokenOrNeedsAction === "boolean"
      ? tokenOrNeedsAction
      : tokenOrNeedsAction === "action";
  return needsAction ? ADMIN_ACTION_ROW_CLASS : "";
}

export function adminRejectedRowClass(needsRejected: boolean): string {
  return needsRejected ? ADMIN_REJECTED_ROW_CLASS : "";
}

export function getDirectorFinalStatusToken(
  tone: DirectorShareholderFinalStatusTone
): StatusToken {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
    case "info":
      return "action";
    case "danger":
    case "expired":
      return "rejected";
    default:
      return "neutral";
  }
}
