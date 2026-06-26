import type { Organization } from "@cashsouk/config";

/** Company org created but user agreement not yet accepted — shown on dashboard. */
export function isAwaitingCompanyTnc(org: Organization): boolean {
  return org.type === "COMPANY" && org.onboardingStatus === "PENDING" && !org.tncAccepted;
}

/** T&C done; fee payment continues on /onboarding-start. */
export function needsOnboardingStartFee(org: Organization): boolean {
  return (
    org.type === "COMPANY" &&
    org.onboardingStatus === "PENDING" &&
    org.tncAccepted === true &&
    !org.onboardingFeePaidAt
  );
}

/** Fee paid; eKYB (RegTank) can start. */
export function isReadyForIssuerEkyc(org: Organization): boolean {
  return (
    org.type === "COMPANY" &&
    org.onboardingStatus === "PENDING" &&
    org.tncAccepted === true &&
    Boolean(org.onboardingFeePaidAt)
  );
}
