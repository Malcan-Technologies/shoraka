/**
 * Status config for applications dashboard.
 *
 * =============================================================================
 * PART 1 — WHAT WE HAVE (the problem)
 * =============================================================================
 *
 * One application can have many statuses at once:
 *   - The application itself has a status (e.g. SUBMITTED)
 *   - The contract (if any) has a status (e.g. OFFER_SENT)
 *   - Each invoice has a status (e.g. one is DRAFT, one is OFFER_SENT, one is APPROVED)
 *
 * But the card can only show ONE badge. So we must pick one.
 * That is what "priority" and "aggregation" mean: when several things say different
 * things, we pick the most important one.
 *
 * =============================================================================
 * PART 2 — WHERE PRIORITY HAPPENS (two places)
 * =============================================================================
 *
 * PLACE 1 — Many invoices, one status (Section D: INVOICE_PRIORITY)
 *
 *   If an app has 3 invoices with statuses DRAFT, OFFER_SENT, APPROVED, we pick one.
 *   We use INVOICE_PRIORITY: the first status in that list that appears wins.
 *   Example: [DRAFT, OFFER_SENT, APPROVED] → we pick OFFER_SENT (because OFFER_SENT comes before
 *   DRAFT and APPROVED in the priority list).
 *
 *   Edit INVOICE_PRIORITY to change which invoice status wins when they differ.
 *
 * PLACE 2 — App + contract + invoices, one badge (Section E: getCardStatus)
 *
 *   After we have one invoice status (from Place 1), we have three things:
 *   - app status (e.g. SUBMITTED)
 *   - contract status (e.g. OFFER_SENT)
 *   - the one invoice status we picked (e.g. OFFER_SENT)
 *
 *   getCardStatus checks them in order. The first if-block that matches wins.
 *   Example: app is SUBMITTED, contract is OFFER_SENT. We check: Rejected? No.
 *   Action Required? No. OFFER_SENT? Yes. So we show "Offer Received".
 *
 *   Edit the order of if-blocks in getCardStatus to change which status wins.
 *
 * =============================================================================
 * PART 3 — THE REST (badges, filter, list order)
 * =============================================================================
 *
 * SECTION A — BADGES
 *   For each status we store: label (what user sees), color, sortOrder (where
 *   the card goes in the list). sortOrder 1 = top, 999 = bottom.
 *
 * SECTION B — FILTER
 *   Which statuses appear in the Filter dropdown. Add a status here if users
 *   should be able to filter by it.
 *
 * SECTION C — LIST ORDER
 *   getSortOrder uses STATUS[].sortOrder. When we sort the list of cards, we
 *   use this. Lower number = higher in the list.
 *
 * =============================================================================
 * PART 4 — TO ADD A NEW STATUS (step by step)
 * =============================================================================
 *
 * Example: API will send "PENDING_DISBURSEMENT". You want a badge "Pending Disbursement".
 *
 * Step 1 — Add to BADGES (Section A):
 *   pending_disbursement: {
 *     label: "Pending Disbursement",
 *     color: "border-blue-500/30 bg-blue-500/10 text-blue-700",
 *     sortOrder: 7,
 *   },
 *
 *   Colors you can use: red, amber, blue, indigo, teal, emerald, slate
 *   Copy the pattern from another badge and change the color word.
 *
 * Step 2 — Add to FILTER (Section B) if users should filter by it:
 *   Add "pending_disbursement" to the FILTER_STATUSES array.
 *
 * Step 3 — Add to getCardStatus (Section E):
 *   if (app === "PENDING_DISBURSEMENT") {
 *     return { badgeKey: "pending_disbursement", displayLabel: "Pending Disbursement", showReviewOffer: false, showMakeAmendments: false };
 *   }
 *
 *   Put it in the right place. The first matching if-block wins. Rejected is
 *   first, then Action Required, then Offer Received, then Under Review, etc.
 *
 * Step 4 — If this status can come from an invoice, add to INVOICE_PRIORITY (Section D):
 *   Add "PENDING_DISBURSEMENT" in the right place in the array.
 */

import { WithdrawReason } from "@cashsouk/types";
import {
  getStatusPresentationByBadgeKey,
  getStatusColorAndLabel,
} from "@cashsouk/config";

export type CardStatusResult = {
  badgeKey: string;
  displayLabel: string;
  showReviewOffer: boolean;
  showMakeAmendments: boolean;
};

export interface NormalizedInvoice {
  id: string;
  number: string;
  maturityDate: string | null;
  value: number | null;
  appliedFinancing: number | null;
  document: string;
  documentS3Key: string | null;
  financingOffered: string;
  profitRate: string;
  status: string;
  offerStatus: "Offer received" | null;
  canReviewOffer: boolean;
  /** Raw offer details from API for modal display. */
  offer_details?: Record<string, unknown> | null;
  /** True when SigningCloud signed PDF is stored (offer_signing.status === signed). */
  signedOfferLetterAvailable: boolean;
  /** S3 key for signed offer letter when available. */
  signedOfferLetterS3Key: string | null;
  /** When status is WITHDRAWN: distinguishes user decline vs withdraw vs expiry (issuer UI). */
  withdrawReason?: WithdrawReason;
}

export interface NormalizedApplication {
  id: string;
  type: "Contract financing" | "Invoice financing" | "Generic";
  status: string;
  cardStatus: CardStatusResult;
  contractTitle: string | null;
  /** Contract ID for signing route. Null when no contract. */
  contractId: string | null;
  customer: string;
  applicationDate: string;
  /** When the issuer submitted the application to admin. Null for drafts. Helps issuer see how long it has been waiting. */
  submittedAt: string | null;
  contractValue: number | null;
  facilityApplied: number | null;
  approvedFacility: string;
  updatedAt: string;
  invoices: NormalizedInvoice[];
  contractStatus: string | null;
  /** Issuer organization ID for query invalidation. */
  issuerOrganizationId?: string;
  /** Withdraw reason when status is withdrawn. From contract or invoice. */
  withdrawReason?: WithdrawReason;
  /** Offer expiry (contract or invoice). ISO string. Used for expiry indicator and filter. */
  expiresAt?: string | null;
  /** True when contract has a stored signed offer letter PDF. */
  signedContractOfferLetterAvailable: boolean;
  /** S3 key for contract signed offer letter when available. */
  signedContractOfferLetterS3Key: string | null;
}

/* =============================================================================
   SECTION A — BADGES (label, color, list order)
   Color from @cashsouk/config status-badges. Labels and sortOrder local.
   ============================================================================= */

const BADGE_FALLBACK = "border-transparent bg-slate-500/10 text-slate-600";

function statusColorClass(badgeKey: string, withdrawReason?: WithdrawReason): string {
  const { color } = getStatusPresentationByBadgeKey(badgeKey, withdrawReason, {
    issuerWithdrawPresentation: true,
  });
  return color || BADGE_FALLBACK;
}

export const STATUS: Record<
  string,
  { label: string; color: string; sortOrder: number }
> = {
  rejected: { label: "Rejected", color: statusColorClass("rejected"), sortOrder: 1 },
  amendment_requested: { label: "Action Required", color: statusColorClass("amendment_requested"), sortOrder: 2 },
  offer_sent: { label: "Offer Received", color: statusColorClass("offer_sent"), sortOrder: 3 },
  under_review: { label: "Under Review", color: statusColorClass("under_review"), sortOrder: 4 },
  submitted: { label: "Submitted", color: statusColorClass("submitted"), sortOrder: 5 },
  resubmitted: { label: "Resubmitted", color: statusColorClass("resubmitted"), sortOrder: 6 },
  draft: { label: "Draft", color: statusColorClass("draft"), sortOrder: 7 },
  accepted: { label: "Approved", color: statusColorClass("accepted"), sortOrder: 8 },
  approved: { label: "Approved", color: statusColorClass("approved"), sortOrder: 8 },
  completed: { label: "Completed", color: statusColorClass("completed"), sortOrder: 9 },
  withdrawn: { label: "Withdrawn", color: statusColorClass("withdrawn"), sortOrder: 10 },
  declined: { label: "Declined", color: statusColorClass("declined"), sortOrder: 10 },
  offer_expired: { label: "Offer Expired", color: statusColorClass("offer_expired"), sortOrder: 10 },
  archived: { label: "Archived", color: statusColorClass("archived"), sortOrder: 11 },
};

export function getSortOrder(status: string): number {
  return STATUS[status]?.sortOrder ?? 999;
}

/** Re-export for consumers that need badge key mapping. */
export { API_STATUS_TO_BADGE_KEY } from "@cashsouk/config";

/** Status badge presentation. Delegates to @cashsouk/config. */
export function getStatusPresentation(
  apiStatus: string,
  withdrawReason?: WithdrawReason
): { color: string; label: string } {
  return getStatusColorAndLabel(apiStatus, withdrawReason, { issuerWithdrawPresentation: true });
}

/* =============================================================================
   SECTION B — FILTER (Status dropdown)
   Add a status here to show it in the Filter menu. Remove to hide it.
   ============================================================================= */

/** Status filter options. Archived is excluded — never shown to user. */
export const FILTER_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "amendment_requested",
  "offer_sent",
  "accepted",
  "completed",
  "withdrawn",
  "declined",
  "offer_expired",
  "rejected",
] as const;

/** Financing type filter options. */
export const FINANCING_TYPES = [
  { value: "contract", label: "Contract financing" },
  { value: "invoice", label: "Invoice financing" },
] as const;

/* =============================================================================
   SECTION D — INVOICE PRIORITY (many invoices → one status)
   Used only for Action Required and Offer Received signals.
   Terminal states (WITHDRAWN, COMPLETED, REJECTED, ARCHIVED) come from application.status only.
   ============================================================================= */

export const INVOICE_PRIORITY = [
  "REJECTED",
  "AMENDMENT_REQUESTED",
  "OFFER_SENT",
  "SUBMITTED",
  "DRAFT",
  "APPROVED",
  "WITHDRAWN",
] as const;

function hasAmendmentRequested(invoiceStatuses: string[]): boolean {
  return invoiceStatuses.some((s) => String(s ?? "").toUpperCase() === "AMENDMENT_REQUESTED");
}

function hasOfferSent(invoiceStatuses: string[]): boolean {
  return invoiceStatuses.some((s) => String(s ?? "").toUpperCase() === "OFFER_SENT");
}

/* =============================================================================
   SECTION E — getCardStatus (urgency-driven, application.status is source of truth)
   Priority: 1) Terminal states (app only), 2) Action Required, 3) Offer Waiting, 4) Normal lifecycle.
   Invoices/contract may trigger Action Required or Offer Received; never override terminal states.
   ============================================================================= */

export function getCardStatus(input: {
  applicationStatus: string;
  contractStatus?: string | null;
  invoiceStatuses: string[];
  withdrawReason?: WithdrawReason;
}): CardStatusResult {
  const app = String(input.applicationStatus ?? "DRAFT").toUpperCase();
  const contract = input.contractStatus ? String(input.contractStatus).toUpperCase() : null;
  const invoiceStatuses = input.invoiceStatuses.map((s) => String(s ?? "DRAFT").toUpperCase());
  const anyInvoiceAmendmentRequested = hasAmendmentRequested(invoiceStatuses);
  const anyInvoiceOfferSent = hasOfferSent(invoiceStatuses);
  const contractAmendmentRequested = contract === "AMENDMENT_REQUESTED";
  const contractOfferSent = contract === "OFFER_SENT";

  /** Terminal states: always from application.status. Invoices/contract must NOT override. */
  if (app === "REJECTED") {
    return { badgeKey: "rejected", displayLabel: "Rejected", showReviewOffer: false, showMakeAmendments: false };
  }
  if (app === "COMPLETED") {
    return { badgeKey: "completed", displayLabel: "Completed", showReviewOffer: false, showMakeAmendments: false };
  }
  if (app === "WITHDRAWN") {
    const wr = input.withdrawReason;
    if (wr === WithdrawReason.OFFER_REJECTED) {
      return { badgeKey: "declined", displayLabel: "Declined", showReviewOffer: false, showMakeAmendments: false };
    }
    if (wr === WithdrawReason.OFFER_EXPIRED) {
      return { badgeKey: "offer_expired", displayLabel: "Offer Expired", showReviewOffer: false, showMakeAmendments: false };
    }
    return { badgeKey: "withdrawn", displayLabel: "Withdrawn", showReviewOffer: false, showMakeAmendments: false };
  }
  if (app === "ARCHIVED") {
    return { badgeKey: "archived", displayLabel: "Archived", showReviewOffer: false, showMakeAmendments: false };
  }

  /** Action Required: app, contract, or any invoice has AMENDMENT_REQUESTED. Highest urgency. */
  if (app === "AMENDMENT_REQUESTED") {
    return { badgeKey: "amendment_requested", displayLabel: "Action Required", showReviewOffer: false, showMakeAmendments: true };
  }
  if (contractAmendmentRequested || anyInvoiceAmendmentRequested) {
    return { badgeKey: "amendment_requested", displayLabel: "Action Required", showReviewOffer: false, showMakeAmendments: false };
  }

  /** Offer Waiting: contract or any invoice has OFFER_SENT. Card-level Review Offer only for contract offers. */
  if (contractOfferSent || anyInvoiceOfferSent) {
    return {
      badgeKey: "offer_sent",
      displayLabel: "Offer Received",
      showReviewOffer: contractOfferSent,
      showMakeAmendments: false,
    };
  }

  /** Normal lifecycle: application.status only. Invoices must NOT override. */
  if (
    app === "UNDER_REVIEW" ||
    app === "CONTRACT_PENDING" ||
    app === "CONTRACT_SENT" ||
    app === "CONTRACT_ACCEPTED" ||
    app === "INVOICE_PENDING" ||
    app === "INVOICES_SENT"
  ) {
    return {
      badgeKey: "under_review",
      displayLabel: "Under Review",
      showReviewOffer: false,
      showMakeAmendments: false,
    };
  }
  if (app === "SUBMITTED") return { badgeKey: "submitted", displayLabel: "Submitted", showReviewOffer: false, showMakeAmendments: false };
  if (app === "RESUBMITTED") return { badgeKey: "resubmitted", displayLabel: "Resubmitted", showReviewOffer: false, showMakeAmendments: false };
  if (app === "DRAFT") return { badgeKey: "draft", displayLabel: "Draft", showReviewOffer: false, showMakeAmendments: false };
  if (app === "APPROVED") return { badgeKey: "accepted", displayLabel: "Approved", showReviewOffer: false, showMakeAmendments: false };

  return { badgeKey: "draft", displayLabel: "Draft", showReviewOffer: false, showMakeAmendments: false };
}

/**
 * Urgency-based sort order. Lower = higher in list.
 * UX order: 1) Needs action, 2) In progress, 3) Draft, 4) Success, 5) Closed.
 */
export const APPLICATION_STATUS_PRIORITY: Record<string, number> = Object.freeze({
  amendment_requested: 1,
  offer_sent: 2,
  under_review: 3,
  submitted: 4,
  resubmitted: 5,
  draft: 6,
  accepted: 7,
  completed: 8,
  withdrawn: 9,
  declined: 9,
  offer_expired: 9,
  rejected: 10,
  archived: 11,
});
