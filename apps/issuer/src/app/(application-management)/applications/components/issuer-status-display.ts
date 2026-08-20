import { badgeKeyToStatusToken, getStatusPresentationByBadgeKey } from "@cashsouk/config";
import type { WithdrawReason } from "@cashsouk/types";
import { formatApplicationReference } from "@cashsouk/types";

export { badgeKeyToStatusToken };

/**
 * Plain-English status for SME issuers (primary badge / card).
 * Falls back to config presentation label when no plain mapping exists.
 */
export function getIssuerPlainStatusLabel(
  badgeKey: string,
  withdrawReason?: WithdrawReason
): string {
  const key = badgeKey?.toLowerCase() ?? "draft";
  const { label: configLabel } = getStatusPresentationByBadgeKey(key, withdrawReason, {
    issuerWithdrawPresentation: true,
  });

  switch (key) {
    case "offer_sent":
      return "Waiting for your response";
    case "amendment_requested":
      return "Needs changes";
    case "under_review":
      return "We're reviewing this";
    case "submitted":
      return "Submitted — waiting for review";
    case "resubmitted":
      return "Resubmitted — waiting for review";
    case "draft":
      return "Draft";
    case "accepted":
    case "approved":
      return "Approved";
    case "completed":
      return "Completed";
    case "rejected":
      return "Not approved";
    case "declined":
      return "You declined this offer";
    case "offer_expired":
      return "Offer expired";
    case "withdrawn":
      return "Withdrawn";
    default:
      return configLabel;
  }
}

/** Prefer acceptance-phase wording when it is more specific than the collapsed badge key. */
export function getIssuerCardStatusLabel(
  badgeKey: string,
  options?: {
    withdrawReason?: WithdrawReason;
    offerAcceptanceStatus?: string | null;
  }
): string {
  if (String(options?.offerAcceptanceStatus ?? "").toUpperCase() === "CHANGES_REQUESTED") {
    return "Changes requested";
  }
  return getIssuerPlainStatusLabel(badgeKey, options?.withdrawReason);
}

export function applicationCardStatusLabel(app: {
  cardStatus: { badgeKey: string };
  withdrawReason?: WithdrawReason;
  offerAcceptanceStatus?: string | null;
  facilityInForceNoInvoices: boolean;
}): string {
  if (app.facilityInForceNoInvoices) return "Facility approved";
  const key = app.cardStatus.badgeKey;
  return getIssuerCardStatusLabel(key, {
    withdrawReason:
      key === "withdrawn" || key === "declined" || key === "offer_expired"
        ? app.withdrawReason
        : undefined,
    offerAcceptanceStatus: app.offerAcceptanceStatus,
  });
}

/** Invoices needing work on the Invoices tab (amendments / rejected). Offer review lives on the Offer tab. */
export function countInvoicesNeedingAction(
  invoices: Array<{ status?: string }>
): number {
  return invoices.filter((inv) => {
    const s = (inv.status ?? "").toUpperCase();
    return s === "AMENDMENT_REQUESTED" || s === "REJECTED";
  }).length;
}

export function formatApplicationDisplayId(
  id: string,
  displayReference?: string | null
): string {
  return formatApplicationReference({ id, displayReference });
}
