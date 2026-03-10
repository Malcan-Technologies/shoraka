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
   Maps status key to label and color. Same status always uses same color
   (card, invoice row, contract section). Standardized for consistency. */

export type BadgeTone = "neutral" | "warning" | "success" | "info" | "danger";

/**
 * Status badge color mapping. Follows design reference and branding.md.
 * Same status = same color everywhere (card, invoice row, contract section).
 * Draft→neutral/muted, Submitted→blue, Under Review→indigo, Offer Sent→teal,
 * Action Required→orange, Approved→green, Rejected→destructive.
 */
export const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  submitted: "border-blue-300/50 bg-blue-100 text-blue-700",
  resubmitted: "border-blue-300/50 bg-blue-100 text-blue-700",
  under_review: "border-indigo-300/50 bg-indigo-100 text-indigo-700",
  sent: "border-teal-300/50 bg-teal-100 text-teal-700",
  offer_expired: "border-border bg-muted text-muted-foreground",
  pending_amendment: "border-orange-300/50 bg-orange-100 text-orange-700",
  amendment_requested: "border-orange-300/50 bg-orange-100 text-orange-700",
  accepted: "border-emerald-300/50 bg-emerald-100 text-emerald-700",
  approved: "border-emerald-300/50 bg-emerald-100 text-emerald-700",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  withdrawn: "border-border bg-muted text-muted-foreground",
  pending_approval: "border-blue-300/50 bg-blue-100 text-blue-700",
};

export const STATUS_BADGES: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  resubmitted: { label: "Resubmitted", tone: "info" },
  pending_amendment: { label: "Action Required", tone: "warning" },
  sent: { label: "Offer Sent", tone: "success" },
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
