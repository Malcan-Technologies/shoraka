/**
 * Applications Dashboard configuration.
 * All status values, badge labels, and sort order come from here.
 * Change this file to update how the dashboard behaves.
 */

/* ============================================================
   Application status constants
   Used everywhere instead of magic strings.
   ============================================================ */

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
   Badge configuration
   Maps status key to label and visual tone.
   UI reads from here for badge text and styling.
   ============================================================ */

export type BadgeTone = "neutral" | "warning" | "success" | "info" | "danger";

export const STATUS_BADGES: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  pending_amendment: { label: "Action Required", tone: "warning" },
  sent: { label: "Offer Received", tone: "success" },
  pending_approval: { label: "Pending Approval", tone: "info" },
  under_review: { label: "Under Review", tone: "neutral" },
  accepted: { label: "Accepted", tone: "success" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

/* ============================================================
   Sort configuration
   Primary: status priority (lower = higher in list).
   Secondary: updated_at (newer first).
   ============================================================ */

export const STATUS_PRIORITY: Record<string, number> = {
  pending_amendment: 1,
  sent: 2,
  pending_approval: 3,
  under_review: 4,
  submitted: 5,
  draft: 6,
  accepted: 7,
  rejected: 8,
  withdrawn: 9,
};

export const SORT_CONFIG = {
  primary: "status_priority" as const,
  secondary: "updated_at" as const,
  direction: "desc" as const,
};
