import type { Organization } from "@cashsouk/config";
import {
  OnboardingStatusCard as SharedOnboardingStatusCard,
  getOnboardingSteps as getSharedOnboardingSteps,
  type OnboardingStatusCardProps as SharedOnboardingStatusCardProps,
} from "@cashsouk/ui";

type OnboardingStatusCardProps = Omit<SharedOnboardingStatusCardProps, "portal" | "subtitle">;

export function OnboardingStatusCard(props: OnboardingStatusCardProps) {
  return (
    <SharedOnboardingStatusCard
      {...props}
      portal="issuer"
      subtitle="Apply for financing and manage your financing applications from your dashboard"
    />
  );
}

export function getOnboardingSteps(organization: Organization) {
  return getSharedOnboardingSteps(organization, "issuer");
}

export type { OnboardingStep } from "@cashsouk/ui";
