/**
 * Person (OrganizationPartyProfile) RegTank individual send decision.
 *
 * CREATE = no current onboarding_json.requestId
 * RESEND = same requestId, stored verifyLink still usable (valid or expiry unknown)
 * RENEW TOKEN = same requestId, stored verifyLink expired
 * RESTART = current requestId exists but verifyLink is missing (new requestId; old request stale)
 * Replacement CREATE happens only after an IN_PROGRESS email correction already
 * cleared the local request.
 */

import { getCtosPartyCurrentOnboardingRequestId, parseCtosPartySupplement } from "./ctos-party-supplement-json";
import { classifyPersonVerifyLinkExpiry } from "./regtank-verify-link";
import { normalizeRawStatus } from "./status-normalization";

/**
 * Same protected/review set as personal org auto-restart exclusion:
 * WAIT_FOR_APPROVAL, LIVENESS_PASSED, PENDING_APPROVAL, APPROVED, REJECTED, COMPLETED.
 * Email lock stays on isPersonEmailLifecycleLocked / canManageDirectorShareholder
 * (WAIT_FOR_APPROVAL + APPROVED + AML terminal). This list is Send-only, including
 * missing-link RESTART.
 */
const PERSON_ONBOARDING_STATUSES_BLOCK_NORMAL_SEND = new Set([
  "WAIT_FOR_APPROVAL",
  "LIVENESS_PASSED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
]);

export type PersonRegTankIndividualSendPlan =
  | { action: "create" }
  | { action: "resend"; requestId: string; verifyLink: string }
  | { action: "renew"; requestId: string; verifyLink: string }
  | { action: "restart"; requestId: string }
  | {
      action: "reject";
      code: "NOT_ALLOWED";
      message: string;
    };

export function isPersonOnboardingStatusBlockedForNormalSend(status: string | null | undefined): boolean {
  return PERSON_ONBOARDING_STATUSES_BLOCK_NORMAL_SEND.has(normalizeRawStatus(status));
}

export function planPersonRegTankIndividualSend(params: {
  supplementRoot: unknown;
  now?: Date;
}): PersonRegTankIndividualSendPlan {
  const parsed = parseCtosPartySupplement(params.supplementRoot);
  if (isPersonOnboardingStatusBlockedForNormalSend(parsed.status)) {
    return {
      action: "reject",
      code: "NOT_ALLOWED",
      message: "Resend is only allowed for actionable individual rows",
    };
  }

  const requestId = getCtosPartyCurrentOnboardingRequestId(params.supplementRoot);
  if (!requestId) {
    return { action: "create" };
  }

  const verifyLink = (parsed.verifyLink ?? "").trim();
  const expiry = classifyPersonVerifyLinkExpiry({
    verifyLink,
    verifyLinkExpiresAt: parsed.verifyLinkExpiresAt,
    now: params.now,
  });

  if (expiry === "missing") {
    return { action: "restart", requestId };
  }

  if (expiry === "valid" || expiry === "unknown") {
    return { action: "resend", requestId, verifyLink };
  }

  return { action: "renew", requestId, verifyLink };
}
