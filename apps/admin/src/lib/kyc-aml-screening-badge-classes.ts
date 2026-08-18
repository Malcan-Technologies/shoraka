import type { StatusToken } from "@cashsouk/ui";

/**
 * KYC/AML screening status → admin status token.
 * Organization onboarding statuses and RegTank guarantor strings share this map.
 */
export function kycAmlScreeningStatusToken(status: string | undefined): StatusToken {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (s === "approved" || s.includes("no match") || s.includes("no_match")) return "success";
  if (
    s === "rejected" ||
    s.includes("positive match") ||
    s.includes("positive_match")
  ) {
    return "rejected";
  }
  if (
    s.includes("pending") ||
    s.includes("unresolved") ||
    s.includes("score generated") ||
    s.includes("screening in progress")
  ) {
    return "action";
  }
  return "neutral";
}

export function kycAmlScreeningRiskToken(riskLevel: string | undefined): StatusToken {
  if (!riskLevel) return "neutral";
  const level = riskLevel.toLowerCase();
  if (level.includes("low")) return "success";
  if (level.includes("high")) return "rejected";
  if (level.includes("medium")) return "action";
  return "neutral";
}

/** @deprecated Prefer StatusBadge + kycAmlScreeningStatusToken. */
export function kycAmlScreeningStatusBadgeClass(status: string | undefined): string {
  return tokenToLegacyClass(kycAmlScreeningStatusToken(status));
}

/** @deprecated Prefer StatusBadge + kycAmlScreeningRiskToken. */
export function kycAmlScreeningRiskLevelBadgeClass(riskLevel: string | undefined): string {
  return tokenToLegacyClass(kycAmlScreeningRiskToken(riskLevel));
}

function tokenToLegacyClass(token: StatusToken): string {
  switch (token) {
    case "success":
      return "bg-status-success-bg text-status-success-text";
    case "rejected":
      return "bg-status-rejected-bg text-status-rejected-text";
    case "action":
      return "bg-status-action-bg text-status-action-text";
    default:
      return "bg-status-neutral-bg text-status-neutral-text";
  }
}
