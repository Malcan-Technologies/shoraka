import type { OrganizationResponse } from "@cashsouk/types";
import { getOrganizationTypePresentation } from "@/lib/organization-status";
import { timestampOrNull, type TableSortValue } from "@/shared/admin-list/table-sort";

export type OrganizationsSortColumn =
  | "organization"
  | "type"
  | "risk"
  | "sophisticated"
  | "deposit"
  | "wallet"
  | "invested"
  | "onboardingFee"
  | "members"
  | "created"
  | "updated";

export function organizationListDisplayName(org: OrganizationResponse): string {
  if (org.type === "COMPANY") {
    return org.name?.trim() || "Unnamed Company";
  }
  return `${org.owner.firstName} ${org.owner.lastName}`.trim() || org.owner.email;
}

function parseRiskScore(value: string | null): number | null {
  if (!value) return null;
  const score = Number(value);
  return Number.isNaN(score) ? null : score;
}

export function organizationsSortValue(
  org: OrganizationResponse,
  column: OrganizationsSortColumn
): TableSortValue {
  switch (column) {
    case "organization":
      return organizationListDisplayName(org);
    case "type":
      return getOrganizationTypePresentation(org.type).label;
    case "risk":
      return parseRiskScore(org.riskScore);
    case "sophisticated":
      return org.isSophisticatedInvestor ? 1 : 0;
    case "deposit":
      return org.depositReceived ? 1 : 0;
    case "wallet":
      return org.walletBalance;
    case "invested":
      return org.investedAmount;
    case "onboardingFee":
      return org.onboardingFeePaid ? 1 : 0;
    case "members":
      return org.memberCount;
    case "created":
      return timestampOrNull(org.createdAt);
    case "updated":
      return timestampOrNull(org.updatedAt);
  }
}
