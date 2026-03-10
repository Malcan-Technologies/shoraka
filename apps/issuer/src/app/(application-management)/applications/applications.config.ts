/**
 * Applications Dashboard configuration. All status values, badge labels, and sort order come from here.
 * Change this file to update how the dashboard behaves.
 */

/* ============================================================
   APPLICATION STATUS
   ============================================================
   Use these everywhere instead of magic strings. */

export const APPLICATION_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  PENDING_APPROVAL: "pending_approval",
  PENDING_AMENDMENT: "pending_amendment",
  SENT: "sent",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
} as const;

/* ============================================================
   BADGE CONFIGURATION
   ============================================================
   Maps status key to label and color. Same status = same color everywhere
   (card, invoice row, contract section).
   Colors adjusted for UI clarity; admin portal (status-presentation.ts,
   application-financial-review-content) used as reference. branding.md
   not strictly followed for status indicators. Global styles unchanged. */

export type BadgeTone = "neutral" | "warning" | "success" | "info" | "danger";

/**
 * Status badge colors. Aligned with admin portal pattern (border-X-500/30 bg-X-500/10).
 * Draft→neutral gray, Submitted→calm blue, Under Review→muted indigo,
 * Offer Received→teal highlight, Action Required→amber warning, Approved→green success,
 * Rejected→red error. Component-level only; no global theme changes.
 */
export const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-700",
  submitted: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  resubmitted: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  under_review: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700",
  sent: "border-teal-500/30 bg-teal-500/10 text-teal-700",
  offer_expired: "border-slate-500/30 bg-slate-500/10 text-slate-600",
  pending_amendment: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  amendment_requested: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  accepted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700",
  withdrawn: "border-slate-500/30 bg-slate-500/10 text-slate-600",
  pending_approval: "border-blue-500/30 bg-blue-500/10 text-blue-700",
};

export const STATUS_BADGES: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  resubmitted: { label: "Resubmitted", tone: "info" },
  pending_amendment: { label: "Action Required", tone: "warning" },
  sent: { label: "Offer Received", tone: "success" },
  offer_expired: { label: "Offer expired", tone: "neutral" },
  pending_approval: { label: "Pending Approval", tone: "info" },
  under_review: { label: "Under Review", tone: "neutral" },
  accepted: { label: "Approved", tone: "success" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  /** Invoice/contract raw status for invoice row display. Same color as pending_amendment. */
  amendment_requested: { label: "Action Required", tone: "warning" },
};

/* ============================================================
   SORT CONFIGURATION
   ============================================================
   Primary sort is status priority (lower number first). Secondary is updated_at (newer first). */

/** Lower number = higher priority (shown first). Matches business priority order. */
export const STATUS_PRIORITY: Record<string, number> = {
  rejected: 1,
  pending_amendment: 2,
  sent: 3,
  under_review: 4,
  submitted: 5,
  resubmitted: 6,
  draft: 7,
  accepted: 8,
  withdrawn: 9,
};

export const SORT_CONFIG = {
  primary: "status_priority" as const,
  secondary: "updated_at" as const,
  direction: "desc" as const,
};
