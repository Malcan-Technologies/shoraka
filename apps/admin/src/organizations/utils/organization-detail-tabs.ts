import type { StatusToken } from "@cashsouk/ui";
import type { OnboardingStatusEnum } from "@cashsouk/types";
import { getOrganizationOnboardingPresentation } from "@/lib/organization-status";
import { adminTabStatusLabel } from "@/lib/admin-status-token";

export const ORG_DETAIL_TAB_IDS = [
  "organization",
  "people",
  "linked-records",
  "acceptances",
  "activity",
] as const;
export type OrgDetailTabId = (typeof ORG_DETAIL_TAB_IDS)[number];

export function isOrgDetailTabId(value: string): value is OrgDetailTabId {
  return (ORG_DETAIL_TAB_IDS as readonly string[]).includes(value);
}

export function isOrgPeopleTabAvailable(orgType: string | null | undefined): boolean {
  return orgType === "COMPANY";
}

export function organizationTabStatus(
  onboardingStatus: OnboardingStatusEnum | string
): { statusToken: StatusToken; statusLabel: string } {
  const presentation = getOrganizationOnboardingPresentation(onboardingStatus, {
    completedLabel: "Onboarded",
  });
  return {
    statusToken: presentation.status,
    statusLabel: adminTabStatusLabel(presentation.status),
  };
}
