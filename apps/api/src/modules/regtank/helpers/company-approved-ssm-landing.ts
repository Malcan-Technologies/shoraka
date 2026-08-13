import { OnboardingStatus } from "@prisma/client";

/**
 * Individual/COD-adjacent APPROVED webhooks used to force company and issuer orgs
 * onto PENDING_SSM_REVIEW. That must only happen as a forward landing from stages
 * that have not yet reached the SSM gate (or any later/terminal stage).
 */
const COMPANY_SSM_LANDING_FROM: ReadonlySet<OnboardingStatus> = new Set([
  OnboardingStatus.PENDING,
  OnboardingStatus.IN_PROGRESS,
]);

export type CompanyApprovedSsmLandingUpdate = {
  nextStatus: "PENDING_SSM_REVIEW";
};

/**
 * Returns a landing update only when APPROVED may advance the org onto
 * PENDING_SSM_REVIEW. Already at PENDING_SSM_REVIEW, later review stages,
 * COMPLETED, and REJECTED return null (no status mutation, no STATUS_CHANGED).
 */
export function getCompanyApprovedSsmLandingUpdate(params: {
  currentOnboardingStatus: OnboardingStatus;
}): CompanyApprovedSsmLandingUpdate | null {
  if (!COMPANY_SSM_LANDING_FROM.has(params.currentOnboardingStatus)) {
    return null;
  }
  return { nextStatus: "PENDING_SSM_REVIEW" };
}
