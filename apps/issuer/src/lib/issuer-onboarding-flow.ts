import type { Organization } from "@cashsouk/config";
import { getOnboardingStep } from "@cashsouk/config";

/** Company org created but user agreement not yet accepted — shown on dashboard. */
export function isAwaitingCompanyTnc(org: Organization): boolean {
  return getOnboardingStep(org, "issuer") === "terms";
}

/** T&C done; fee payment continues on /onboarding/fee. */
export function needsOnboardingStartFee(org: Organization): boolean {
  return getOnboardingStep(org, "issuer") === "fee";
}

/** Fee paid; eKYB (RegTank) can start. */
export function isReadyForIssuerEkyc(org: Organization): boolean {
  return getOnboardingStep(org, "issuer") === "verify";
}
