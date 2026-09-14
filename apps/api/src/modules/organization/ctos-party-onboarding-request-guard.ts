import {
  getCtosPartyCurrentOnboardingRequestId,
  isCurrentCtosPartyOnboardingRequest,
} from "@cashsouk/types";
import { logger } from "../../lib/logger";

type CtosPartySupplementLike = {
  party_key: string;
  issuer_organization_id: string | null;
  investor_organization_id: string | null;
  onboarding_json: unknown;
};

/**
 * After referenceId/requestId lookup, ignore webhooks that are not the current
 * onboarding_json.requestId so a replaced RegTank request cannot mutate state.
 */
export function shouldIgnoreStaleCtosPartyOnboardingWebhook(params: {
  supplement: CtosPartySupplementLike;
  incomingOnboardingRequestId: string | null | undefined;
  webhookType: "liveness" | "kyc";
}): boolean {
  if (isCurrentCtosPartyOnboardingRequest(params.supplement.onboarding_json, params.incomingOnboardingRequestId)) {
    return false;
  }
  logger.info(
    {
      organization:
        params.supplement.issuer_organization_id || params.supplement.investor_organization_id || "",
      party_key: params.supplement.party_key,
      currentRequestId: getCtosPartyCurrentOnboardingRequestId(params.supplement.onboarding_json),
      incomingRequestId: String(params.incomingOnboardingRequestId ?? "").trim(),
      webhookType: params.webhookType,
      reason: "stale/replaced onboarding request",
    },
    "Ignored stale CTOS party onboarding webhook"
  );
  return true;
}
