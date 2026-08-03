import type { Organization } from "@cashsouk/config";
import {
  OnboardingStatusCard as SharedOnboardingStatusCard,
  getOnboardingSteps as getSharedOnboardingSteps,
  type OnboardingStatusCardProps as SharedOnboardingStatusCardProps,
} from "@cashsouk/ui";

type OnboardingStatusCardProps = Omit<SharedOnboardingStatusCardProps, "portal">;

export function OnboardingStatusCard(props: OnboardingStatusCardProps) {
  return <SharedOnboardingStatusCard {...props} portal="investor" />;
}

export function getOnboardingSteps(organization: Organization) {
  return getSharedOnboardingSteps(organization, "investor");
}

export type { OnboardingStep } from "@cashsouk/ui";
