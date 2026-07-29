/**
 * Centralized status badge config. Four semantic colour groups (+ neutral):
 * - issuer_action: Issuer must act (amber — status.action)
 * - admin_action: Waiting on CashSouk (blue — status.submitted)
 * - completed: Success / signed (emerald — status.success)
 * - expired_closed: Negative / closed (red — status.rejected)
 * - neutral: Inactive (slate — status.neutral)
 */

import {
  WithdrawReason,
  formatWithdrawLabel,
  type OfferAcceptanceStatus,
  type SigningEnvelopeStatus,
} from "@cashsouk/types";

export type StatusPresentationOptions = {
  /**
   * Issuer portal: WITHDRAWN is shown as Declined (offer rejected), Withdrawn (user cancelled),
   * or Offer Expired — not the generic admin-oriented withdraw strings.
   */
  issuerWithdrawPresentation?: boolean;
};

export type StatusBadgeGroup =
  | "issuer_action"
  | "admin_action"
  | "completed"
  | "expired_closed"
  | "neutral";

/** Semantic variant; withdrawn uses expired_closed styling but distinct for issuer logic. */
export type StatusVariant = StatusBadgeGroup | "withdrawn";

/** Tailwind classes for badge, icon, dot. Same pattern everywhere. */
export interface StatusPresentation {
  label: string;
  badgeClass: string;
  iconClass: string;
  dotClass: string;
  variant: StatusVariant;
}

/** Shared badge classes per group. Dots use brighter fills than label text so small circles stay distinguishable. */
export const STATUS_BADGE_GROUPS: Record<
  StatusBadgeGroup,
  { badgeClass: string; iconClass: string; dotClass: string; label: string }
> = {
  issuer_action: {
    label: "Issuer action",
    badgeClass:
      "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
    iconClass: "text-amber-600 dark:text-amber-400",
    dotClass: "bg-status-action-text",
  },
  admin_action: {
    label: "Admin action",
    badgeClass:
      "border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300",
    iconClass: "text-blue-600 dark:text-blue-400",
    dotClass: "bg-status-submitted-text",
  },
  completed: {
    label: "Completed",
    badgeClass:
      "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
    iconClass: "text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
  },
  expired_closed: {
    label: "Expired / closed",
    badgeClass:
      "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300",
    iconClass: "text-red-600 dark:text-red-400",
    dotClass: "bg-status-rejected-text",
  },
  neutral: {
    label: "Neutral",
    badgeClass:
      "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    iconClass: "text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-400 dark:bg-slate-500",
  },
};

const GROUP = Object.fromEntries(
  Object.entries(STATUS_BADGE_GROUPS).map(([key, value]) => [key, value.badgeClass])
) as Record<StatusBadgeGroup, string>;

const ICON = Object.fromEntries(
  Object.entries(STATUS_BADGE_GROUPS).map(([key, value]) => [key, value.iconClass])
) as Record<StatusBadgeGroup, string>;

const DOT = Object.fromEntries(
  Object.entries(STATUS_BADGE_GROUPS).map(([key, value]) => [key, value.dotClass])
) as Record<StatusBadgeGroup, string>;

function groupPresentation(
  group: StatusBadgeGroup,
  label?: string,
  variant?: StatusVariant
): Omit<StatusPresentation, "label"> & { label?: string } {
  return {
    label,
    badgeClass: GROUP[group],
    iconClass: ICON[group],
    dotClass: DOT[group],
    variant: variant ?? group,
  };
}

const STATUS_PRESENTATION: Record<string, Omit<StatusPresentation, "label"> & { label?: string }> = {
  DRAFT: { ...groupPresentation("issuer_action"), label: "Draft" },
  SUBMITTED: { ...groupPresentation("admin_action"), label: "Submitted" },
  UNDER_REVIEW: { ...groupPresentation("admin_action"), label: "Under Review" },
  CONTRACT_PENDING: { ...groupPresentation("admin_action"), label: "Contract Pending" },
  CONTRACT_SENT: { ...groupPresentation("issuer_action"), label: "Contract Sent" },
  CONTRACT_ACCEPTED: { ...groupPresentation("admin_action"), label: "Contract Accepted" },
  INVOICE_ACCEPTED: { ...groupPresentation("admin_action"), label: "Invoice Accepted" },
  SIGNING_PENDING: { ...groupPresentation("admin_action"), label: "Signing Pending" },
  CONTRACT_SIGNED: { ...groupPresentation("completed"), label: "Contract Signed" },
  INVOICE_SIGNED: { ...groupPresentation("completed"), label: "Invoice Signed" },
  INVOICE_PENDING: { ...groupPresentation("admin_action"), label: "Invoice Pending" },
  INVOICES_SENT: { ...groupPresentation("issuer_action"), label: "Invoices Sent" },
  OFFER_SENT: { ...groupPresentation("issuer_action"), label: "Offer Sent" },
  AMENDMENT_REQUESTED: { ...groupPresentation("issuer_action"), label: "Amendment Requested" },
  RESUBMITTED: { ...groupPresentation("admin_action"), label: "Resubmitted" },
  APPROVED: { ...groupPresentation("completed"), label: "Approved" },
  COMPLETED: { ...groupPresentation("completed"), label: "Completed" },
  REJECTED: { ...groupPresentation("expired_closed"), label: "Rejected" },
  WITHDRAWN: { ...groupPresentation("expired_closed", undefined, "withdrawn"), label: "Withdrawn" },
  DECLINED: { ...groupPresentation("expired_closed"), label: "Declined" },
  OFFER_EXPIRED: {
    ...groupPresentation("expired_closed", undefined, "withdrawn"),
    label: "Offer Expired",
  },
  ARCHIVED: { ...groupPresentation("neutral"), label: "Archived" },
  PENDING: { ...groupPresentation("neutral"), label: "Pending" },
};

const PENDING_FALLBACK: StatusPresentation = {
  label: "Pending",
  badgeClass: GROUP.neutral,
  iconClass: ICON.neutral,
  dotClass: DOT.neutral,
  variant: "neutral",
};

const OFFER_ACCEPTANCE_PHASE_GROUP: Record<OfferAcceptanceStatus, StatusBadgeGroup> = {
  PENDING_ISSUER: "issuer_action",
  CHANGES_REQUESTED: "issuer_action",
  PENDING_ADMIN_REVIEW: "admin_action",
  APPROVED_FOR_SIGNING: "admin_action",
  SIGNING_IN_PROGRESS: "admin_action",
  COMPLETED: "completed",
  REJECTED: "expired_closed",
  DECLINED: "expired_closed",
};

const SIGNING_ENVELOPE_STATUS_GROUP: Record<SigningEnvelopeStatus, StatusBadgeGroup> = {
  DRAFT: "neutral",
  SENT: "issuer_action",
  IN_PROGRESS: "issuer_action",
  COMPLETED: "completed",
  DECLINED: "expired_closed",
  VOIDED: "expired_closed",
  EXPIRED: "expired_closed",
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
  INVOICE_ACCEPTED: "under_review",
  SIGNING_PENDING: "under_review",
  CONTRACT_SIGNED: "accepted",
  INVOICE_SIGNED: "accepted",
  INVOICE_PENDING: "under_review",
  INVOICES_SENT: "under_review",
  AMENDMENT_REQUESTED: "amendment_requested",
  RESUBMITTED: "resubmitted",
  OFFER_SENT: "offer_sent",
  OFFER_EXPIRED: "offer_expired",
  APPROVED: "approved",
  COMPLETED: "completed",
  WITHDRAWN: "withdrawn",
  REJECTED: "rejected",
  ARCHIVED: "archived",
};

export { API_STATUS_TO_BADGE_KEY };

/**
 * Maps API invoice/application status + withdraw reason to issuer card/table badge key.
 * WITHDRAWN + OFFER_REJECTED → declined; OFFER_EXPIRED → offer_expired; else API map.
 * When entity stays OFFER_SENT, offer_acceptance phase can collapse the row to under_review.
 */
export function resolveIssuerInvoiceStatusBadgeKey(
  status: string | undefined,
  withdrawReason?: WithdrawReason,
  offerAcceptanceStatus?: string | null
): string {
  const upper = String(status ?? "").toUpperCase();
  if (upper === "WITHDRAWN" && withdrawReason === WithdrawReason.OFFER_REJECTED) {
    return "declined";
  }
  if (upper === "OFFER_EXPIRED") {
    return "offer_expired";
  }
  if (upper === "OFFER_SENT" && offerAcceptanceStatus) {
    const phase = String(offerAcceptanceStatus).toUpperCase();
    const issuerMustAct = phase === "PENDING_ISSUER" || phase === "CHANGES_REQUESTED";
    const adminReviewOrSigning =
      phase === "PENDING_ADMIN_REVIEW" ||
      phase === "APPROVED_FOR_SIGNING" ||
      phase === "SIGNING_IN_PROGRESS" ||
      phase === "COMPLETED";
    if (adminReviewOrSigning && !issuerMustAct) {
      return "under_review";
    }
  }
  return API_STATUS_TO_BADGE_KEY[upper] ?? (status?.toLowerCase() ?? "draft");
}

/** All application status keys for dev/showcase pages. */
export const STATUS_EXAMPLE_KEYS = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CONTRACT_PENDING",
  "CONTRACT_SENT",
  "CONTRACT_ACCEPTED",
  "INVOICE_ACCEPTED",
  "SIGNING_PENDING",
  "CONTRACT_SIGNED",
  "INVOICE_SIGNED",
  "INVOICE_PENDING",
  "INVOICES_SENT",
  "OFFER_SENT",
  "OFFER_EXPIRED",
  "AMENDMENT_REQUESTED",
  "RESUBMITTED",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED",
  "PENDING",
] as const;

/** Offer acceptance phase keys for dev/showcase pages. */
export const OFFER_ACCEPTANCE_EXAMPLE_KEYS = [
  "PENDING_ISSUER",
  "PENDING_ADMIN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED_FOR_SIGNING",
  "SIGNING_IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "DECLINED",
] as const satisfies readonly OfferAcceptanceStatus[];

/** Signing envelope status keys for dev/showcase pages. */
export const SIGNING_ENVELOPE_EXAMPLE_KEYS = [
  "DRAFT",
  "SENT",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
  "VOIDED",
  "EXPIRED",
] as const satisfies readonly SigningEnvelopeStatus[];

/** Badge class for offer acceptance phase badges (Acceptance tab). */
export function getOfferAcceptancePhaseBadgeClass(status: OfferAcceptanceStatus): string {
  return GROUP[OFFER_ACCEPTANCE_PHASE_GROUP[status]];
}

/** Badge class for signing envelope status badges. */
export function getSigningEnvelopeBadgeClass(status: SigningEnvelopeStatus): string {
  return GROUP[SIGNING_ENVELOPE_STATUS_GROUP[status]];
}

/** Badge key (lowercase) → presentation. For issuer card badges. */
const BADGE_KEY_PRESENTATION: Record<string, StatusPresentation> = {
  draft: { ...STATUS_PRESENTATION.DRAFT, label: "Draft" } as StatusPresentation,
  submitted: { ...STATUS_PRESENTATION.SUBMITTED, label: "Submitted" } as StatusPresentation,
  under_review: { ...STATUS_PRESENTATION.UNDER_REVIEW, label: "Under Review" } as StatusPresentation,
  amendment_requested: {
    ...STATUS_PRESENTATION.AMENDMENT_REQUESTED,
    label: "Action Required",
  } as StatusPresentation,
  resubmitted: { ...STATUS_PRESENTATION.RESUBMITTED, label: "Resubmitted" } as StatusPresentation,
  offer_sent: { ...STATUS_PRESENTATION.OFFER_SENT, label: "Offer Received" } as StatusPresentation,
  accepted: { ...STATUS_PRESENTATION.APPROVED, label: "Approved" } as StatusPresentation,
  approved: { ...STATUS_PRESENTATION.APPROVED, label: "Approved" } as StatusPresentation,
  completed: { ...STATUS_PRESENTATION.COMPLETED, label: "Completed" } as StatusPresentation,
  withdrawn: { ...STATUS_PRESENTATION.WITHDRAWN, label: "Withdrawn" } as StatusPresentation,
  declined: { ...STATUS_PRESENTATION.DECLINED, label: "Declined" } as StatusPresentation,
  offer_expired: { ...STATUS_PRESENTATION.OFFER_EXPIRED, label: "Offer Expired" } as StatusPresentation,
  rejected: { ...STATUS_PRESENTATION.REJECTED, label: "Rejected" } as StatusPresentation,
  archived: { ...STATUS_PRESENTATION.ARCHIVED, label: "Archived" } as StatusPresentation,
};

/**
 * Get presentation by badge key (issuer card status). Returns { color, label } for compatibility.
 */
export function getStatusPresentationByBadgeKey(
  badgeKey: string,
  withdrawReason?: WithdrawReason,
  options?: StatusPresentationOptions
): { color: string; label: string } {
  const key = badgeKey?.toLowerCase() ?? "draft";
  const issuer = options?.issuerWithdrawPresentation === true;

  if (issuer && withdrawReason === WithdrawReason.OFFER_REJECTED) {
    const pres = BADGE_KEY_PRESENTATION.declined;
    return { color: pres.badgeClass, label: "Declined" };
  }

  if (key === "declined") {
    const pres = BADGE_KEY_PRESENTATION.declined;
    return { color: pres.badgeClass, label: pres.label ?? "Declined" };
  }

  if (key === "offer_expired") {
    const pres = BADGE_KEY_PRESENTATION.offer_expired;
    return { color: pres.badgeClass, label: pres.label ?? "Offer Expired" };
  }

  if (key === "withdrawn") {
    const pres = BADGE_KEY_PRESENTATION.withdrawn;
    if (issuer) {
      return { color: pres.badgeClass, label: "Withdrawn" };
    }
    const label = formatWithdrawLabel(withdrawReason);
    return { color: pres.badgeClass, label };
  }

  const pres = BADGE_KEY_PRESENTATION[key] ?? PENDING_FALLBACK;
  const label = pres.label ?? toLabel(badgeKey);
  return { color: pres.badgeClass, label };
}

/**
 * Get status presentation for admin/issuer badges. Use for ApplicationStatusBadge, ReviewStepStatusBadge.
 * Admin: uses raw STATUS_PRESENTATION (Contract Pending, Contract Sent, etc.).
 * Issuer card: uses collapsed BADGE_KEY_PRESENTATION via getStatusPresentationByBadgeKey.
 */
export function getStatusPresentation(
  status: string,
  withdrawReason?: WithdrawReason,
  options?: StatusPresentationOptions
): StatusPresentation {
  const upper = status?.toUpperCase() ?? "";
  const issuer = options?.issuerWithdrawPresentation === true;

  if (upper === "WITHDRAWN" && issuer) {
    if (withdrawReason === WithdrawReason.OFFER_REJECTED) {
      return { ...STATUS_PRESENTATION.DECLINED, label: "Declined" } as StatusPresentation;
    }
    return { ...STATUS_PRESENTATION.WITHDRAWN, label: "Withdrawn" } as StatusPresentation;
  }

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
  withdrawReason?: WithdrawReason,
  options?: StatusPresentationOptions
): { color: string; label: string } {
  const p = getStatusPresentation(apiStatus, withdrawReason, options);
  return { color: p.badgeClass, label: p.label };
}

/**
 * Get color class string only (for inline badges without icon). Returns badgeClass.
 */
export function getStatusBadgeClass(
  status: string,
  withdrawReason?: WithdrawReason,
  options?: StatusPresentationOptions
): string {
  return getStatusPresentation(status, withdrawReason, options).badgeClass;
}
