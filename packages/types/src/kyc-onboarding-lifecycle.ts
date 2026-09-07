/**
 * SECTION: Party KYC onboarding lifecycle
 * WHY: People KYC badges must follow Send onboarding, not "person exists / KYC required"
 * INPUT: Pipeline status plus optional send evidence (request id, EOD, sentAt)
 * OUTPUT: Canonical onboarding status for people[] and KYC chips
 * WHERE USED: People list builder, CtosPartySupplement, getFinalStatusLabel
 */

import { normalizeRawStatus } from "./status-normalization";

const NOT_STARTED_TOKENS = new Set(["NOT_STARTED", "REQUIRED", "KYC_REQUIRED", "NONE", "IDLE"]);

export type PartyKycOnboardingEvidence = {
  status?: string | null;
  requestId?: string | null;
  eodRequestId?: string | null;
  shareholderEodRequestId?: string | null;
  kycId?: string | null;
  sentAt?: string | null;
  lastSentAt?: string | null;
};

export function isKycOnboardingNotStartedToken(statusRaw: unknown): boolean {
  const s = normalizeRawStatus(statusRaw);
  return !s || NOT_STARTED_TOKENS.has(s);
}

export function isDraftPartyOnboardingRequestId(requestId: string | null | undefined): boolean {
  const t = String(requestId ?? "").trim();
  return !t || /^draft-/i.test(t);
}

function hasNonEmpty(value: string | null | undefined): boolean {
  return Boolean(String(value ?? "").trim());
}

/** True when a real onboarding request was created or emailed — not a draft/placeholder row. */
export function hasKycOnboardingSendEvidence(params: PartyKycOnboardingEvidence): boolean {
  if (hasNonEmpty(params.sentAt) || hasNonEmpty(params.lastSentAt)) return true;
  if (!isDraftPartyOnboardingRequestId(params.requestId)) return true;
  if (hasNonEmpty(params.eodRequestId) || hasNonEmpty(params.shareholderEodRequestId)) return true;
  if (hasNonEmpty(params.kycId)) return true;
  return false;
}

/**
 * Status stored on people[].onboarding.status.
 * Empty / NOT_STARTED / placeholder PENDING (no request) → null (Not Started).
 */
export function canonicalPartyKycOnboardingStatus(params: PartyKycOnboardingEvidence): string | null {
  const status = normalizeRawStatus(params.status);
  if (isKycOnboardingNotStartedToken(status)) return null;
  if (status === "PENDING" && !hasKycOnboardingSendEvidence(params)) return null;
  return status || null;
}
