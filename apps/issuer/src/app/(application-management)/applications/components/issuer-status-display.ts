import type { StatusToken } from "@cashsouk/ui";
import { getStatusPresentationByBadgeKey } from "@cashsouk/config";
import type { WithdrawReason } from "@cashsouk/types";

/**
 * Map collapsed issuer badge keys → shared StatusBadge tokens (viewer-centric):
 * yellow/action = issuer must respond · blue/submitted = waiting on admin ·
 * green/success = good · red/rejected = bad · slate/neutral = terminal/closed.
 */
export function badgeKeyToStatusToken(badgeKey: string): StatusToken {
  switch (badgeKey?.toLowerCase()) {
    case "draft":
    case "amendment_requested":
    case "offer_sent":
      return "action";
    case "submitted":
    case "resubmitted":
    case "under_review":
      return "submitted";
    case "accepted":
    case "approved":
      return "success";
    case "rejected":
    case "declined":
    case "offer_expired":
      return "rejected";
    case "completed":
    case "withdrawn":
    case "archived":
      return "neutral"; // terminal / closed
    default:
      return "neutral";
  }
}

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

/** Invoices needing work on the Invoices tab (amendments / rejected). Offer review lives on the Offer tab. */
export function countInvoicesNeedingAction(
  invoices: Array<{ status?: string }>
): number {
  return invoices.filter((inv) => {
    const s = (inv.status ?? "").toUpperCase();
    return s === "AMENDMENT_REQUESTED" || s === "REJECTED";
  }).length;
}

export function formatApplicationDisplayId(id: string): string {
  return `#${id.slice(-8).toUpperCase()}`;
}

export function formatSubmittedDate(submittedAt: string | null | undefined): string {
  if (!submittedAt) return "Not submitted";
  const d = new Date(submittedAt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
