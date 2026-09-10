/**
 * Person (OrganizationPartyProfile) RegTank individual send decision.
 * Same-email Send during an active request resends the stored verifyLink.
 * A new POST /v3/onboarding/indv/request is only for first send or an
 * IN_PROGRESS email correction that already cleared the local request.
 */

import { getCtosPartyCurrentOnboardingRequestId, parseCtosPartySupplement } from "./ctos-party-supplement-json";
import { normalizeRawStatus } from "./status-normalization";

const ONBOARDING_STATUSES_BLOCK_REPLACEMENT = new Set(["WAIT_FOR_APPROVAL", "APPROVED"]);

export const PERSON_REGTANK_VERIFY_LINK_UNAVAILABLE =
  "The current onboarding request has no stored verification link to resend. Creating a replacement RegTank request requires a Person Email change during IN_PROGRESS, or business/RegTank confirmation.";

export type PersonRegTankIndividualSendPlan =
  | { action: "create" }
  | { action: "resend"; requestId: string; verifyLink: string }
  | {
      action: "reject";
      code: "NOT_ALLOWED" | "VERIFY_LINK_UNAVAILABLE";
      message: string;
    };

export function planPersonRegTankIndividualSend(params: {
  supplementRoot: unknown;
}): PersonRegTankIndividualSendPlan {
  const parsed = parseCtosPartySupplement(params.supplementRoot);
  const status = normalizeRawStatus(parsed.status);
  if (ONBOARDING_STATUSES_BLOCK_REPLACEMENT.has(status)) {
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
  if (!verifyLink) {
    return {
      action: "reject",
      code: "VERIFY_LINK_UNAVAILABLE",
      message: PERSON_REGTANK_VERIFY_LINK_UNAVAILABLE,
    };
  }

  return { action: "resend", requestId, verifyLink };
}
