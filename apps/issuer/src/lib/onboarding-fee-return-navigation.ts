/** Why the onboarding-fee return dialog closed. */
export type OnboardingFeeReturnCloseReason = "dismiss" | "success";

/**
 * Success continues to verify in one navigation. Clearing return params must not
 * replace back to `/onboarding/fee` first (that remounts the fee page and flashes).
 */
export function shouldClearOnboardingFeeReturnParams(
  reason?: OnboardingFeeReturnCloseReason
): boolean {
  return reason !== "success";
}

export const ONBOARDING_FEE_SUCCESS_CONTINUE_PATH = "/onboarding/verify";
