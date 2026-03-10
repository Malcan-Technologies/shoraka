/**
 * Status config for applications dashboard.
 *
 * =============================================================================
 * PART 1 — WHAT WE HAVE (the problem)
 * =============================================================================
 *
 * One application can have many statuses at once:
 *   - The application itself has a status (e.g. SUBMITTED)
 *   - The contract (if any) has a status (e.g. SENT)
 *   - Each invoice has a status (e.g. one is DRAFT, one is SENT, one is APPROVED)
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
 *   If an app has 3 invoices with statuses DRAFT, SENT, APPROVED, we pick one.
 *   We use INVOICE_PRIORITY: the first status in that list that appears wins.
 *   Example: [DRAFT, SENT, APPROVED] → we pick SENT (because SENT comes before
 *   DRAFT and APPROVED in the priority list).
 *
 *   Edit INVOICE_PRIORITY to change which invoice status wins when they differ.
 *
 * PLACE 2 — App + contract + invoices, one badge (Section E: getCardStatus)
 *
 *   After we have one invoice status (from Place 1), we have three things:
 *   - app status (e.g. SUBMITTED)
 *   - contract status (e.g. SENT)
 *   - the one invoice status we picked (e.g. SENT)
 *
 *   getCardStatus checks them in order. The first if-block that matches wins.
 *   Example: app is SUBMITTED, contract is SENT. We check: Rejected? No.
 *   Action Required? No. SENT? Yes. So we show "Offer Received".
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
  offerStatus: "Offer received" | "Offer expired" | null;
  canReviewOffer: boolean;
  offerExpiresAt: string | null;
}

export interface NormalizedApplication {
  id: string;
  type: "Contract financing" | "Invoice financing" | "Generic";
  status: string;
  cardStatus: CardStatusResult;
  hasExpiredOffer: boolean;
  contractTitle: string | null;
  customer: string;
  applicationDate: string;
  contractValue: number | null;
  facilityApplied: number | null;
  approvedFacility: string;
  updatedAt: string;
  invoices: NormalizedInvoice[];
  contractStatus: string | null;
  offerExpiresAt: string | null;
}

/* =============================================================================
   SECTION A — BADGES (label, color, list order)
   label = what user sees on the badge
   color = Tailwind classes for the badge
   sortOrder = where the card goes in the list (1 = top, 999 = bottom)
   ============================================================================= */

export const STATUS: Record<
  string,
  { label: string; color: string; sortOrder: number }
> = {
  rejected: { label: "Rejected", color: "border-red-500/30 bg-red-500/10 text-red-700", sortOrder: 1 },
  pending_amendment: { label: "Action Required", color: "border-amber-500/30 bg-amber-500/10 text-amber-700", sortOrder: 2 },
  sent: { label: "Offer Received", color: "border-teal-500/30 bg-teal-500/10 text-teal-700", sortOrder: 3 },
  offer_expired: { label: "Offer expired", color: "border-slate-500/30 bg-slate-500/10 text-slate-600", sortOrder: 3 },
  under_review: { label: "Under Review", color: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700", sortOrder: 4 },
  submitted: { label: "Submitted", color: "border-blue-500/30 bg-blue-500/10 text-blue-700", sortOrder: 5 },
  resubmitted: { label: "Resubmitted", color: "border-blue-500/30 bg-blue-500/10 text-blue-700", sortOrder: 6 },
  draft: { label: "Draft", color: "border-slate-500/30 bg-slate-500/10 text-slate-700", sortOrder: 7 },
  accepted: { label: "Approved", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", sortOrder: 8 },
  approved: { label: "Approved", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", sortOrder: 8 },
  archived: { label: "Archived", color: "border-slate-500/30 bg-slate-500/10 text-slate-600", sortOrder: 10 },
  /* withdrawn: border-slate-500/30 bg-slate-500/10 text-slate-600 */
  amendment_requested: { label: "Action Required", color: "border-amber-500/30 bg-amber-500/10 text-amber-700", sortOrder: 2 },
};

export function getSortOrder(status: string): number {
  return STATUS[status]?.sortOrder ?? 999;
}

/* =============================================================================
   SECTION B — FILTER (Status dropdown)
   Add a status here to show it in the Filter menu. Remove to hide it.
   ============================================================================= */

export const FILTER_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "pending_amendment",
  "sent",
  "accepted",
  "rejected",
] as const;

/* =============================================================================
   SECTION D — INVOICE PRIORITY (many invoices → one status)
   When an app has multiple invoices with different statuses, we pick one.
   First status in this list that appears in the invoices wins.
   Example: invoices [DRAFT, SENT, APPROVED] → we pick SENT (SENT comes before
   DRAFT and APPROVED in the list).
   Edit this array to change which invoice status wins.
   ============================================================================= */

export const INVOICE_PRIORITY = [
  "REJECTED",
  "AMENDMENT_REQUESTED",
  "SENT",
  "SUBMITTED",
  "DRAFT",
  "APPROVED",
] as const;

function pickInvoiceStatus(invoiceStatuses: string[]): string | null {
  if (invoiceStatuses.length === 0) return null;
  for (const s of INVOICE_PRIORITY) {
    if (invoiceStatuses.includes(s)) return s;
  }
  return invoiceStatuses[0];
}

/* =============================================================================
   SECTION E — getCardStatus (app + contract + invoices → one badge)
   We have three inputs: app status, contract status, and the one invoice status
   from pickInvoiceStatus. We check them in order. First if-block that matches
   wins. Edit the order of if-blocks to change which status wins.
   ============================================================================= */

export function getCardStatus(input: {
  applicationStatus: string;
  contractStatus?: string | null;
  invoiceStatuses: string[];
}): CardStatusResult {
  const app = String(input.applicationStatus ?? "DRAFT").toUpperCase();
  const contract = input.contractStatus ? String(input.contractStatus).toUpperCase() : null;
  const inv = pickInvoiceStatus(input.invoiceStatuses.map((s) => String(s ?? "DRAFT").toUpperCase()));

  if (app === "REJECTED" || contract === "REJECTED") {
    return { badgeKey: "rejected", displayLabel: "Rejected", showReviewOffer: false, showMakeAmendments: false };
  }
  if (contract === "AMENDMENT_REQUESTED" || inv === "AMENDMENT_REQUESTED") {
    return { badgeKey: "pending_amendment", displayLabel: "Action Required", showReviewOffer: false, showMakeAmendments: true };
  }
  if (contract === "SENT" || inv === "SENT") {
    return { badgeKey: "sent", displayLabel: "Offer Received", showReviewOffer: true, showMakeAmendments: false };
  }
  if (app === "UNDER_REVIEW") return { badgeKey: "under_review", displayLabel: "Under Review", showReviewOffer: false, showMakeAmendments: false };
  if (app === "SUBMITTED") return { badgeKey: "submitted", displayLabel: "Submitted", showReviewOffer: false, showMakeAmendments: false };
  if (app === "RESUBMITTED") return { badgeKey: "resubmitted", displayLabel: "Resubmitted", showReviewOffer: false, showMakeAmendments: false };
  if (app === "DRAFT") return { badgeKey: "draft", displayLabel: "Draft", showReviewOffer: false, showMakeAmendments: false };
  if (app === "APPROVED") return { badgeKey: "accepted", displayLabel: "Approved", showReviewOffer: false, showMakeAmendments: false };
  if (app === "ARCHIVED") return { badgeKey: "archived", displayLabel: "Archived", showReviewOffer: false, showMakeAmendments: false };

  return { badgeKey: "draft", displayLabel: "Draft", showReviewOffer: false, showMakeAmendments: false };
}
