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
   Maps status key to label and visual tone. The UI reads from here for badge text and styling. */

export type BadgeTone = "neutral" | "warning" | "success" | "info" | "danger";

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
  accepted: { label: "Accepted", tone: "success" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  /** Invoice/contract raw status for invoice row display. */
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
