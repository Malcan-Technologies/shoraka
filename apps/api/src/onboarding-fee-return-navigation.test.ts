import {
  ONBOARDING_FEE_SUCCESS_CONTINUE_PATH,
  shouldClearOnboardingFeeReturnParams,
} from "../../issuer/src/lib/onboarding-fee-return-navigation";

describe("onboarding fee return navigation", () => {
  it("clears return params back to the fee page on dismiss/cancel/error close", () => {
    expect(shouldClearOnboardingFeeReturnParams("dismiss")).toBe(true);
    expect(shouldClearOnboardingFeeReturnParams(undefined)).toBe(true);
  });

  it("does not clear return params via fee-page replace on success", () => {
    expect(shouldClearOnboardingFeeReturnParams("success")).toBe(false);
  });

  it("continues to verify after successful payment confirmation", () => {
    expect(ONBOARDING_FEE_SUCCESS_CONTINUE_PATH).toBe("/onboarding/verify");
  });
});
