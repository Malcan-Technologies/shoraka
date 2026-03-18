/**
 * Centralized status badge config for application, product, and admin pages.
 * Single source of truth: label + Tailwind color classes.
 * Aligned with Cashsouk branding: red(s) + taupe + neutrals. Uses Tailwind palette.
 *
 * Semantic groups:
 * - success (emerald): approved, completed, offer_sent, contract_accepted
 * - in-progress (blue): submitted, under_review, contract_*, invoice_*
 * - action (amber): amendment_requested, resubmitted, draft
 * - rejected (red): rejected
 * - neutral (slate): pending, archived, withdrawn
 * - expired (amber): withdrawn_offer_expired
 */

import { WithdrawReason, formatWithdrawLabel } from "@cashsouk/types";

export type StatusVariant =
  | "success"
  | "in_progress"
  | "action"
  | "rejected"
  | "neutral"
  | "expired";

/** Tailwind classes for badge, icon, dot. Same pattern everywhere. */
export interface StatusPresentation {
  label: string;
  badgeClass: string;
  iconClass: string;
  dotClass: string;
  variant: StatusVariant;
}

/** API status (uppercase) → presentation. */
const STATUS_PRESENTATION: Record<string, Omit<StatusPresentation, "label"> & { label?: string }> = {
  DRAFT: {
    label: "Draft",
    badgeClass: "border-transparent bg-amber-500/10 text-amber-700",
    iconClass: "text-amber-600",
    dotClass: "bg-amber-500",
    variant: "action",
  },
  SUBMITTED: {
    label: "Submitted",
    badgeClass: "border-transparent bg-blue-500/10 text-blue-600",
    iconClass: "text-blue-600",
    dotClass: "bg-blue-500",
    variant: "in_progress",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    badgeClass: "border-transparent bg-blue-500/10 text-blue-600",
    iconClass: "text-blue-600",
    dotClass: "bg-blue-500",
    variant: "in_progress",
  },
  CONTRACT_PENDING: {
    label: "Contract Pending",
    badgeClass: "border-transparent bg-blue-500/10 text-blue-600",
    iconClass: "text-blue-600",
    dotClass: "bg-blue-500",
    variant: "in_progress",
  },
  CONTRACT_SENT: {
    label: "Contract Sent",
    badgeClass: "border-transparent bg-blue-500/10 text-blue-600",
    iconClass: "text-blue-600",
    dotClass: "bg-blue-500",
    variant: "in_progress",
  },
  CONTRACT_ACCEPTED: {
    label: "Contract Accepted",
    badgeClass: "border-transparent bg-emerald-500/10 text-emerald-700",
    iconClass: "text-emerald-600",
    dotClass: "bg-emerald-500",
    variant: "success",
  },
  INVOICE_PENDING: {
    label: "Invoice Pending",
    badgeClass: "border-transparent bg-blue-500/10 text-blue-600",
    iconClass: "text-blue-600",
    dotClass: "bg-blue-500",
    variant: "in_progress",
  },
  INVOICES_SENT: {
    label: "Invoices Sent",
    badgeClass: "border-transparent bg-blue-500/10 text-blue-600",
    iconClass: "text-blue-600",
    dotClass: "bg-blue-500",
    variant: "in_progress",
  },
  OFFER_SENT: {
    label: "Offer Sent",
    badgeClass: "border-transparent bg-emerald-500/10 text-emerald-700",
    iconClass: "text-emerald-600",
    dotClass: "bg-emerald-500",
    variant: "success",
  },
  AMENDMENT_REQUESTED: {
    label: "Amendment Requested",
    badgeClass: "border-transparent bg-amber-500/10 text-amber-700",
    iconClass: "text-amber-600",
    dotClass: "bg-amber-500",
    variant: "action",
  },
  RESUBMITTED: {
    label: "Resubmitted",
    badgeClass: "border-transparent bg-amber-500/10 text-amber-700",
    iconClass: "text-amber-600",
    dotClass: "bg-amber-500",
    variant: "action",
  },
  APPROVED: {
    label: "Approved",
    badgeClass: "border-transparent bg-emerald-500/10 text-emerald-700",
    iconClass: "text-emerald-600",
    dotClass: "bg-emerald-500",
    variant: "success",
  },
  COMPLETED: {
    label: "Completed",
    badgeClass: "border-transparent bg-emerald-500/10 text-emerald-700",
    iconClass: "text-emerald-600",
    dotClass: "bg-emerald-500",
    variant: "success",
  },
  REJECTED: {
    label: "Rejected",
    badgeClass: "border-transparent bg-red-500/10 text-red-600",
    iconClass: "text-red-600",
    dotClass: "bg-red-500",
    variant: "rejected",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    badgeClass: "border-transparent bg-slate-500/10 text-slate-600 dark:bg-slate-600/20 dark:text-slate-300",
    iconClass: "text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-500",
    variant: "neutral",
  },
  ARCHIVED: {
    label: "Archived",
    badgeClass: "border-transparent bg-slate-500/10 text-slate-600",
    iconClass: "text-slate-600",
    dotClass: "bg-slate-500",
    variant: "neutral",
  },
  PENDING: {
    label: "Pending",
    badgeClass: "border-transparent bg-slate-500/10 text-slate-600",
    iconClass: "text-slate-600",
    dotClass: "bg-slate-500",
    variant: "neutral",
  },
  withdrawn_offer_expired: {
    label: "Withdrawn (Offer expired)",
    badgeClass: "border-transparent bg-amber-500/10 text-amber-700",
    iconClass: "text-amber-600",
    dotClass: "bg-amber-500",
    variant: "expired",
  },
};

const PENDING_FALLBACK: StatusPresentation = {
  label: "Pending",
  badgeClass: "border-transparent bg-slate-500/10 text-slate-600",
  iconClass: "text-slate-600",
  dotClass: "bg-slate-500",
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

/** Badge key (lowercase) → presentation. For issuer card badges. */
const BADGE_KEY_PRESENTATION: Record<string, StatusPresentation> = {
  draft: { ...STATUS_PRESENTATION.DRAFT, label: "Draft" } as StatusPresentation,
  submitted: { ...STATUS_PRESENTATION.SUBMITTED, label: "Submitted" } as StatusPresentation,
  under_review: { ...STATUS_PRESENTATION.UNDER_REVIEW, label: "Under Review" } as StatusPresentation,
  pending_amendment: { ...STATUS_PRESENTATION.AMENDMENT_REQUESTED, label: "Action Required" } as StatusPresentation,
  amendment_requested: { ...STATUS_PRESENTATION.AMENDMENT_REQUESTED, label: "Action Required" } as StatusPresentation,
  resubmitted: { ...STATUS_PRESENTATION.RESUBMITTED, label: "Resubmitted" } as StatusPresentation,
  offer_sent: { ...STATUS_PRESENTATION.OFFER_SENT, label: "Offer Received" } as StatusPresentation,
  accepted: { ...STATUS_PRESENTATION.APPROVED, label: "Approved" } as StatusPresentation,
  approved: { ...STATUS_PRESENTATION.APPROVED, label: "Approved" } as StatusPresentation,
  completed: { ...STATUS_PRESENTATION.COMPLETED, label: "Completed" } as StatusPresentation,
  withdrawn: { ...STATUS_PRESENTATION.WITHDRAWN, label: "Withdrawn" } as StatusPresentation,
  withdrawn_offer_expired: { ...STATUS_PRESENTATION.withdrawn_offer_expired, label: "Withdrawn (Offer expired)" } as StatusPresentation,
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
  const withdrawnExpired =
    key === "withdrawn" && withdrawReason === WithdrawReason.OFFER_EXPIRED;
  const pres = withdrawnExpired
    ? BADGE_KEY_PRESENTATION.withdrawn_offer_expired
    : BADGE_KEY_PRESENTATION[key] ?? PENDING_FALLBACK;

  const label =
    key === "withdrawn" ? formatWithdrawLabel(withdrawReason) : (pres.label ?? toLabel(badgeKey));

  return { color: pres.badgeClass, label };
}

/**
 * Get status presentation for admin/issuer badges. Use for ApplicationStatusBadge, ReviewStepStatusBadge.
 */
export function getStatusPresentation(
  status: string,
  withdrawReason?: WithdrawReason
): StatusPresentation {
  const badgeKey =
    status?.toUpperCase() === "WITHDRAWN" && withdrawReason === WithdrawReason.OFFER_EXPIRED
      ? "withdrawn_offer_expired"
      : API_STATUS_TO_BADGE_KEY[status?.toUpperCase() ?? ""] ?? status?.toLowerCase() ?? "draft";

  const pres = BADGE_KEY_PRESENTATION[badgeKey] ?? PENDING_FALLBACK;
  const label =
    status?.toUpperCase() === "WITHDRAWN"
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
