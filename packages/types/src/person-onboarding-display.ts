import { normalizeRawStatus } from "./status-normalization";
import { displayGovernmentIdentityNumber } from "./organization-party-key";

export const PERSON_IDENTITY_PENDING_ONBOARDING = "Pending onboarding";
export const PERSON_IDENTITY_NOT_AVAILABLE = "Not available";
export const PERSON_COMPLETE_ONBOARDING_FIRST = "Complete onboarding first";

export function isPersonKycApproved(status: string | null | undefined): boolean {
  return normalizeRawStatus(status) === "APPROVED";
}

export function isOnboardingEligibleIndividual(params: {
  entityType?: string | null;
  isDirector?: boolean;
  isShareholder?: boolean;
}): boolean {
  if (params.entityType === "CORPORATE") return false;
  return params.isDirector === true || params.isShareholder === true;
}

/**
 * Hide full ComRep missing-field warnings until KYC is APPROVED.
 * When `kycOnboardingStatus` is omitted, existing callers keep current behaviour.
 */
export function shouldDeferOnboardingPersonComrep(params: {
  entityType?: string | null;
  isDirector?: boolean;
  isShareholder?: boolean;
  kycOnboardingStatus?: string | null;
}): boolean {
  if (params.kycOnboardingStatus === undefined) return false;
  if (!isOnboardingEligibleIndividual(params)) return false;
  return !isPersonKycApproved(params.kycOnboardingStatus);
}

export function personIdentityDisplay(params: {
  identityNumber?: string | null;
  partyKey?: string | null;
  matchKey?: string | null;
  kycOnboardingStatus?: string | null;
}): { value: string; pending: boolean; governmentId: string | null } {
  const governmentId = displayGovernmentIdentityNumber({
    partyKey: params.partyKey ?? params.matchKey,
    identityNumber: params.identityNumber,
  });
  if (governmentId) {
    return { value: governmentId, pending: false, governmentId };
  }
  const pending = !isPersonKycApproved(params.kycOnboardingStatus);
  return {
    value: pending ? PERSON_IDENTITY_PENDING_ONBOARDING : PERSON_IDENTITY_NOT_AVAILABLE,
    pending,
    governmentId: null,
  };
}
