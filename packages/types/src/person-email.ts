import { isCtosPartySupplementApprovalLocked, parseCtosPartySupplement } from "./ctos-party-supplement-json";
import { getAmlGroup, getKycGroup } from "./director-shareholder-single-status-display";
import { isDraftPartyOnboardingRequestId } from "./kyc-onboarding-lifecycle";
import { normalizeRawStatus } from "./status-normalization";

export const PERSON_EMAIL_HELP =
  "Used for signing, onboarding, person-specific OTPs, and person-specific business mail. This is not the login email. Warning: changing it may require the person to complete KYC identity verification again and may require authorised representatives to be reviewed again before a new signing package can be created.";

export function normalizePersonEmail(value: unknown): string | null {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed || null;
}

/** Displayed Person Email: master first, then a legacy people-row email. Never User/Account Email. */
export function displayedPersonEmail(params: {
  partyEmail?: string | null;
  personEmail?: string | null;
}): string {
  const party = String(params.partyEmail ?? "").trim();
  if (party) return party;
  return String(params.personEmail ?? "").trim();
}

export function hasPersonOnboardingPipeline(supplementRoot: unknown): boolean {
  const s = parseCtosPartySupplement(supplementRoot);
  const requestId = (s.requestId ?? "").trim();
  const liveRequest = Boolean(requestId) && !isDraftPartyOnboardingRequestId(requestId);
  return Boolean(liveRequest || (s.status ?? "").trim() || (s.sentAt ?? "").trim() || s.screening);
}

function personOnboardingStatus(params: {
  supplementRoot?: unknown;
  onboardingStatus?: string | null;
}): string {
  const parsed = parseCtosPartySupplement(params.supplementRoot);
  const supplementStatus = normalizeRawStatus(parsed.status);
  return supplementStatus || normalizeRawStatus(params.onboardingStatus);
}

function personScreeningStatus(params: {
  supplementRoot?: unknown;
  screeningStatus?: string | null;
}): string {
  const parsed = parseCtosPartySupplement(params.supplementRoot);
  const supplementStatus = normalizeRawStatus(parsed.screening?.status);
  return supplementStatus || normalizeRawStatus(params.screeningStatus);
}

/**
 * Person Email edit lock. Separate from send/resend (`planPersonRegTankIndividualSend`
 * / `canManageDirectorShareholder`). Locked only while KYC is awaiting approval.
 */
export function isPersonEmailLifecycleLocked(params: {
  supplementRoot?: unknown;
  legacyKycApproved?: boolean;
  onboardingStatus?: string | null;
  screeningStatus?: string | null;
}): boolean {
  return getKycGroup(personOnboardingStatus(params)) === "PENDING_REVIEW";
}

export function isPersonEmailPostCompletionWrite(params: {
  supplementRoot?: unknown;
  legacyKycApproved?: boolean;
  onboardingStatus?: string | null;
  screeningStatus?: string | null;
}): boolean {
  if (params.legacyKycApproved) return true;
  if (isCtosPartySupplementApprovalLocked(params.supplementRoot)) return true;
  const kycGroup = getKycGroup(personOnboardingStatus(params));
  const amlGroup = getAmlGroup(personScreeningStatus(params));
  return (
    kycGroup === "APPROVED" ||
    kycGroup === "REJECTED" ||
    kycGroup === "EXPIRED" ||
    amlGroup === "APPROVED" ||
    amlGroup === "REJECTED"
  );
}

export type PersonEmailWritePlan =
  | { action: "noop"; email: string | null }
  | { action: "reject"; code: "DIRECTOR_SHAREHOLDER_NOT_EDITABLE"; message: string }
  | {
      action: "write";
      email: string | null;
      pipelineReset: boolean;
      screeningReset: boolean;
      snapshotSupplement: boolean;
    };

/**
 * Canonical Person Email write decision.
 * Editability is independent of onboarding send/resend. Empty master may be seeded;
 * filled master is not overwritten in fill-empty mode. Pending-review KYC stays locked.
 * Post-KYC / AML-terminal writes persist without resetting those pipelines.
 */
export function planPersonEmailWrite(params: {
  currentMasterEmail: string | null | undefined;
  incomingEmail: unknown;
  supplementRoot?: unknown;
  legacyKycApproved?: boolean;
  onboardingStatus?: string | null;
  screeningStatus?: string | null;
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

  if (
    isPersonEmailLifecycleLocked({
      supplementRoot: params.supplementRoot,
      onboardingStatus: params.onboardingStatus,
      screeningStatus: params.screeningStatus,
    })
  ) {
    return {
      action: "reject",
      code: "DIRECTOR_SHAREHOLDER_NOT_EDITABLE",
      message: "Email cannot be edited while onboarding is awaiting approval.",
    };
  }

  const pipeline = hasPersonOnboardingPipeline(params.supplementRoot);
  const persistWithoutReset = isPersonEmailPostCompletionWrite({
    supplementRoot: params.supplementRoot,
    legacyKycApproved: params.legacyKycApproved,
    onboardingStatus: params.onboardingStatus,
    screeningStatus: params.screeningStatus,
  });
  const reset = pipeline && !persistWithoutReset;
  return {
    action: "write",
    email: incoming,
    pipelineReset: reset,
    screeningReset: reset,
    snapshotSupplement: true,
  };
}
