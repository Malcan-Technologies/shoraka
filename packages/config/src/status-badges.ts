/**
 * Centralized status badge config. Colors grouped by meaning:
 * - action: Draft, Amendment Requested — user must act
 * - submitted: Submitted, Resubmitted — waiting for admin pickup
 * - in-progress: Under Review, Contract/Invoice Pending/Sent, Offer Sent — admin processing / awaiting issuer
 * - success: Approved, Completed, Contract Accepted — done
 * - rejected: Rejected, Withdrawn — negative outcome
 * - neutral: Pending, Archived — inactive
 */

import { WithdrawReason, formatWithdrawLabel } from "@cashsouk/types";

export type StatusVariant =
  | "success"
  | "in_progress"
  | "action"
  | "rejected"
  | "neutral"
  | "withdrawn";

/** Tailwind classes for badge, icon, dot. Same pattern everywhere. */
export interface StatusPresentation {
  label: string;
  badgeClass: string;
  iconClass: string;
  dotClass: string;
  variant: StatusVariant;
}

/** Shared badge classes per group. Dots use brighter fills than label text so small circles stay distinguishable. */
const GROUP = {
  action: "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
  submitted: "border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300",
  "in-progress": "border-transparent bg-status-in-progress-bg text-status-in-progress-text dark:bg-indigo-950/40 dark:text-indigo-300",
  success: "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300",
  neutral: "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
};
const DOT = {
  action: "bg-status-action-text",
  submitted: "bg-status-submitted-text",
  "in-progress": "bg-status-in-progress-text",
  success: "bg-emerald-500 dark:bg-emerald-400",
  rejected: "bg-status-rejected-text",
  neutral: "bg-slate-400 dark:bg-slate-500",
};

const STATUS_PRESENTATION: Record<string, Omit<StatusPresentation, "label"> & { label?: string }> = {
  DRAFT: {
    label: "Draft",
    badgeClass: GROUP.action,
    iconClass: "text-amber-600 dark:text-amber-400",
    dotClass: DOT.action,
    variant: "action",
  },
  SUBMITTED: {
    label: "Submitted",
    badgeClass: GROUP.submitted,
    iconClass: "text-blue-600 dark:text-blue-400",
    dotClass: DOT.submitted,
    variant: "in_progress",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    badgeClass: GROUP["in-progress"],
    iconClass: "text-indigo-600 dark:text-indigo-400",
    dotClass: DOT["in-progress"],
    variant: "in_progress",
  },
  CONTRACT_PENDING: {
    label: "Contract Pending",
    badgeClass: GROUP["in-progress"],
    iconClass: "text-indigo-600 dark:text-indigo-400",
    dotClass: DOT["in-progress"],
    variant: "in_progress",
  },
  CONTRACT_SENT: {
    label: "Contract Sent",
    badgeClass: GROUP["in-progress"],
    iconClass: "text-indigo-600 dark:text-indigo-400",
    dotClass: DOT["in-progress"],
    variant: "in_progress",
  },
  CONTRACT_ACCEPTED: {
    label: "Contract Accepted",
    badgeClass: GROUP.success,
    iconClass: "text-emerald-700 dark:text-emerald-400",
    dotClass: DOT.success,
    variant: "success",
  },
  INVOICE_PENDING: {
    label: "Invoice Pending",
    badgeClass: GROUP["in-progress"],
    iconClass: "text-indigo-600 dark:text-indigo-400",
    dotClass: DOT["in-progress"],
    variant: "in_progress",
  },
  INVOICES_SENT: {
    label: "Invoices Sent",
    badgeClass: GROUP["in-progress"],
    iconClass: "text-indigo-600 dark:text-indigo-400",
    dotClass: DOT["in-progress"],
    variant: "in_progress",
  },
  OFFER_SENT: {
    label: "Offer Sent",
    badgeClass: GROUP["in-progress"],
    iconClass: "text-indigo-600 dark:text-indigo-400",
    dotClass: DOT["in-progress"],
    variant: "in_progress",
  },
  AMENDMENT_REQUESTED: {
    label: "Amendment Requested",
    badgeClass: GROUP.action,
    iconClass: "text-amber-600 dark:text-amber-400",
    dotClass: DOT.action,
    variant: "action",
  },
  RESUBMITTED: {
    label: "Resubmitted",
    badgeClass: GROUP.submitted,
    iconClass: "text-blue-600 dark:text-blue-400",
    dotClass: DOT.submitted,
    variant: "in_progress",
  },
  APPROVED: {
    label: "Approved",
    badgeClass: GROUP.success,
    iconClass: "text-emerald-700 dark:text-emerald-400",
    dotClass: DOT.success,
    variant: "success",
  },
  COMPLETED: {
    label: "Completed",
    badgeClass: GROUP.success,
    iconClass: "text-emerald-700 dark:text-emerald-400",
    dotClass: DOT.success,
    variant: "success",
  },
  REJECTED: {
    label: "Rejected",
    badgeClass: GROUP.rejected,
    iconClass: "text-red-600 dark:text-red-400",
    dotClass: DOT.rejected,
    variant: "rejected",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    badgeClass: GROUP.rejected,
    iconClass: "text-red-600 dark:text-red-400",
    dotClass: DOT.rejected,
    variant: "withdrawn",
  },
  ARCHIVED: {
    label: "Archived",
    badgeClass: GROUP.neutral,
    iconClass: "text-slate-600 dark:text-slate-400",
    dotClass: DOT.neutral,
    variant: "neutral",
  },
  PENDING: {
    label: "Pending",
    badgeClass: GROUP.neutral,
    iconClass: "text-slate-600 dark:text-slate-400",
    dotClass: DOT.neutral,
    variant: "neutral",
  },
};

const PENDING_FALLBACK: StatusPresentation = {
  label: "Pending",
  badgeClass: GROUP.neutral,
  iconClass: "text-slate-600 dark:text-slate-400",
  dotClass: DOT.neutral,
  variant: "neutral",
};

function toLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** API status → badge key for issuer card/filter logic. */
const API_STATUS_TO_BADGE_KEY: Record<string, string> = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  CONTRACT_PENDING: "under_review",
  CONTRACT_SENT: "under_review",
  CONTRACT_ACCEPTED: "under_review",
  INVOICE_PENDING: "under_review",
  INVOICES_SENT: "under_review",
  AMENDMENT_REQUESTED: "amendment_requested",
  RESUBMITTED: "resubmitted",
  OFFER_SENT: "offer_sent",
  APPROVED: "approved",
  COMPLETED: "completed",
  WITHDRAWN: "withdrawn",
  REJECTED: "rejected",
  ARCHIVED: "archived",
};

export { API_STATUS_TO_BADGE_KEY };

/** All status keys for dev/showcase pages. */
export const STATUS_EXAMPLE_KEYS = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CONTRACT_PENDING",
  "CONTRACT_SENT",
  "CONTRACT_ACCEPTED",
  "INVOICE_PENDING",
  "INVOICES_SENT",
  "OFFER_SENT",
  "AMENDMENT_REQUESTED",
  "RESUBMITTED",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED",
  "PENDING",
] as const;

/** Badge key (lowercase) → presentation. For issuer card badges. */
const BADGE_KEY_PRESENTATION: Record<string, StatusPresentation> = {
  draft: { ...STATUS_PRESENTATION.DRAFT, label: "Draft" } as StatusPresentation,
  submitted: { ...STATUS_PRESENTATION.SUBMITTED, label: "Submitted" } as StatusPresentation,
  under_review: { ...STATUS_PRESENTATION.UNDER_REVIEW, label: "Under Review" } as StatusPresentation,
  amendment_requested: { ...STATUS_PRESENTATION.AMENDMENT_REQUESTED, label: "Action Required" } as StatusPresentation,
  resubmitted: { ...STATUS_PRESENTATION.RESUBMITTED, label: "Resubmitted" } as StatusPresentation,
  offer_sent: { ...STATUS_PRESENTATION.OFFER_SENT, label: "Offer Received" } as StatusPresentation,
  accepted: { ...STATUS_PRESENTATION.APPROVED, label: "Approved" } as StatusPresentation,
  approved: { ...STATUS_PRESENTATION.APPROVED, label: "Approved" } as StatusPresentation,
  completed: { ...STATUS_PRESENTATION.COMPLETED, label: "Completed" } as StatusPresentation,
  withdrawn: { ...STATUS_PRESENTATION.WITHDRAWN, label: "Withdrawn" } as StatusPresentation,
  rejected: { ...STATUS_PRESENTATION.REJECTED, label: "Rejected" } as StatusPresentation,
  archived: { ...STATUS_PRESENTATION.ARCHIVED, label: "Archived" } as StatusPresentation,
};

/**
 * Get presentation by badge key (issuer card status). Returns { color, label } for compatibility.
 */
export function getStatusPresentationByBadgeKey(
  badgeKey: string,
  withdrawReason?: WithdrawReason
): { color: string; label: string } {
  const key = badgeKey?.toLowerCase() ?? "draft";
  const pres = BADGE_KEY_PRESENTATION[key] ?? PENDING_FALLBACK;
  const label =
    key === "withdrawn" ? formatWithdrawLabel(withdrawReason) : (pres.label ?? toLabel(badgeKey));
  return { color: pres.badgeClass, label };
}

/**
 * Get status presentation for admin/issuer badges. Use for ApplicationStatusBadge, ReviewStepStatusBadge.
 * Admin: uses raw STATUS_PRESENTATION (Contract Pending, Contract Sent, etc.).
 * Issuer card: uses collapsed BADGE_KEY_PRESENTATION via getStatusPresentationByBadgeKey.
 */
export function getStatusPresentation(
  status: string,
  withdrawReason?: WithdrawReason
): StatusPresentation {
  const upper = status?.toUpperCase() ?? "";
  const rawPres = STATUS_PRESENTATION[upper];
  if (rawPres) {
    const label =
      upper === "WITHDRAWN"
        ? formatWithdrawLabel(withdrawReason)
        : (rawPres.label ?? toLabel(status || "Pending"));
    return { ...rawPres, label } as StatusPresentation;
  }
  const badgeKey = API_STATUS_TO_BADGE_KEY[upper] ?? status?.toLowerCase() ?? "draft";
  const pres = BADGE_KEY_PRESENTATION[badgeKey] ?? PENDING_FALLBACK;
  const label =
    upper === "WITHDRAWN"
      ? formatWithdrawLabel(withdrawReason)
      : (pres.label ?? toLabel(status || "Pending"));
  return { ...pres, label } as StatusPresentation;
}

/**
 * Get { color, label } for inline badges (issuer invoice, etc). Color = badgeClass.
 */
export function getStatusColorAndLabel(
  apiStatus: string,
  withdrawReason?: WithdrawReason
): { color: string; label: string } {
  const p = getStatusPresentation(apiStatus, withdrawReason);
  return { color: p.badgeClass, label: p.label };
}

/**
 * Get color class string only (for inline badges without icon). Returns badgeClass.
 */
export function getStatusBadgeClass(
  status: string,
  withdrawReason?: WithdrawReason
): string {
  return getStatusPresentation(status, withdrawReason).badgeClass;
}
