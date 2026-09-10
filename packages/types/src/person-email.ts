import { isCtosPartySupplementApprovalLocked, parseCtosPartySupplement } from "./ctos-party-supplement-json";
import { isDraftPartyOnboardingRequestId } from "./kyc-onboarding-lifecycle";
import { normalizeRawStatus } from "./status-normalization";

export const PERSON_EMAIL_HELP =
  "Used for onboarding, signing, and platform invitations for this person.";

const AML_STATUSES_LOCK_EMAIL = new Set([
  "REJECTED",
  "FAILED",
  "DECLINED",
  "APPROVED",
  "AML_APPROVED",
  "CLEAR",
]);

const ONBOARDING_STATUSES_LOCK_EMAIL = new Set(["WAIT_FOR_APPROVAL", "APPROVED"]);

export function normalizePersonEmail(value: unknown): string | null {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed || null;
}

export function hasPersonOnboardingPipeline(supplementRoot: unknown): boolean {
  const s = parseCtosPartySupplement(supplementRoot);
  const requestId = (s.requestId ?? "").trim();
  const liveRequest = Boolean(requestId) && !isDraftPartyOnboardingRequestId(requestId);
  return Boolean(liveRequest || (s.status ?? "").trim() || (s.sentAt ?? "").trim() || s.screening);
}

export function isPersonEmailLifecycleLocked(params: {
  supplementRoot?: unknown;
  legacyKycApproved?: boolean;
  onboardingStatus?: string | null;
  screeningStatus?: string | null;
}): boolean {
  if (params.legacyKycApproved) return true;
  if (isCtosPartySupplementApprovalLocked(params.supplementRoot)) return true;
  const parsed = parseCtosPartySupplement(params.supplementRoot);
  const onboarding = normalizeRawStatus(params.onboardingStatus ?? parsed.status);
  const screening = normalizeRawStatus(params.screeningStatus ?? parsed.screening?.status);
  if (screening && AML_STATUSES_LOCK_EMAIL.has(screening)) return true;
  if (ONBOARDING_STATUSES_LOCK_EMAIL.has(onboarding)) return true;
  return false;
}

export type PersonEmailWritePlan =
  | { action: "noop"; email: string | null }
  | { action: "reject"; code: "KYC_ALREADY_APPROVED" | "DIRECTOR_SHAREHOLDER_NOT_EDITABLE"; message: string }
  | {
      action: "write";
      email: string | null;
      pipelineReset: boolean;
      screeningReset: boolean;
      snapshotSupplement: boolean;
    };

/**
 * Canonical Person Email write decision. Empty master may be seeded; filled master
 * is not overwritten in fill-empty mode. Locked pipeline statuses cannot be bypassed.
 */
export function planPersonEmailWrite(params: {
  currentMasterEmail: string | null | undefined;
  incomingEmail: unknown;
  supplementRoot?: unknown;
  legacyKycApproved?: boolean;
  fillEmptyOnly?: boolean;
}): PersonEmailWritePlan {
  const current = normalizePersonEmail(params.currentMasterEmail);
  const incoming = normalizePersonEmail(params.incomingEmail);
  if (params.fillEmptyOnly && current) {
    return { action: "noop", email: current };
  }
  if (incoming === current) {
    return { action: "noop", email: current };
  }

  const locked = isPersonEmailLifecycleLocked({
    supplementRoot: params.supplementRoot,
    legacyKycApproved: params.legacyKycApproved,
  });
  if (locked) {
    if (
      params.legacyKycApproved ||
      isCtosPartySupplementApprovalLocked(params.supplementRoot)
    ) {
      return {
        action: "reject",
        code: "KYC_ALREADY_APPROVED",
        message: "This person has already completed KYC. Email cannot be changed.",
      };
    }
    return {
      action: "reject",
      code: "DIRECTOR_SHAREHOLDER_NOT_EDITABLE",
      message: "Email cannot be edited at this stage",
    };
  }

  const pipeline = hasPersonOnboardingPipeline(params.supplementRoot);
  const emailChanged = incoming !== current;
  return {
    action: "write",
    email: incoming,
    pipelineReset: emailChanged && pipeline,
    screeningReset: emailChanged && pipeline,
    snapshotSupplement: true,
  };
}
