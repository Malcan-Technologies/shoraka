import type { UserOrganizationSummary } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";
import { getOrganizationOnboardingPresentation } from "@/lib/organization-status";
import { adminTabStatusLabel } from "@/lib/admin-status-token";

export const USER_ACCOUNT_TAB_IDS = ["account", "organizations"] as const;
export type UserAccountTabId = (typeof USER_ACCOUNT_TAB_IDS)[number];

export function isUserAccountTabId(value: string): value is UserAccountTabId {
  return (USER_ACCOUNT_TAB_IDS as readonly string[]).includes(value);
}

export function userAccountTabStatus(emailVerified: boolean): {
  statusToken: StatusToken;
  statusLabel: string;
} {
  const statusToken: StatusToken = emailVerified ? "success" : "action";
  return { statusToken, statusLabel: adminTabStatusLabel(statusToken) };
}

export function userOrganizationsTabStatus(
  organizations: Pick<UserOrganizationSummary, "onboardingStatus">[]
): { statusToken: StatusToken; statusLabel: string } {
  if (organizations.length === 0) {
    return { statusToken: "neutral", statusLabel: adminTabStatusLabel("neutral") };
  }

  const tokens = organizations.map(
    (org) => getOrganizationOnboardingPresentation(org.onboardingStatus).status
  );
  const statusToken: StatusToken = tokens.some((token) => token === "action")
    ? "action"
    : tokens.some((token) => token === "submitted" || token === "in-progress")
      ? "submitted"
      : tokens.some((token) => token === "rejected")
        ? "rejected"
        : tokens.every((token) => token === "success")
          ? "success"
          : "neutral";

  return { statusToken, statusLabel: adminTabStatusLabel(statusToken) };
}
