import {
  buildApplicationProcessingFeeCallbackUrl,
  buildGatewayCallbackUrl,
  buildIssuerExcessLateChargeCallbackUrl,
  buildIssuerFacilityFeeCallbackUrl,
  buildIssuerOnboardingFeeCallbackUrl,
} from "./curlec-checkout";

describe("facility fee Curlec callback URL", () => {
  it("builds an issuer facility-fee callback with a sanitized payment id param", () => {
    expect(
      buildIssuerFacilityFeeCallbackUrl(
        "pay_abc-1",
        "/financing/contracts/con_1",
        "https://issuer.cashsouk.com"
      )
    ).toBe(
      "https://issuer.cashsouk.com/financing/facility-fee/callback?facilityFeeId=pay_abc-1&returnTo=%2Ffinancing%2Fcontracts%2Fcon_1"
    );
  });

  it("follows the same gateway builder as onboarding and processing-fee callbacks", () => {
    const origin = "https://issuer.cashsouk.com";
    const shared = buildGatewayCallbackUrl({
      portalOrigin: origin,
      callbackPath: "/financing/facility-fee/callback",
      paymentId: "pay_1",
      paymentIdParam: "facilityFeeId",
      returnTo: "/financing/contracts/con_1",
    });

    expect(buildIssuerFacilityFeeCallbackUrl("pay_1", "/financing/contracts/con_1", origin)).toBe(
      shared
    );
    expect(buildIssuerOnboardingFeeCallbackUrl("fee_1", "/onboarding/fee", origin)).toContain(
      "/onboarding-fee/callback?onboardingFeeId=fee_1"
    );
    expect(
      buildApplicationProcessingFeeCallbackUrl("fee_2", "/applications/a1/edit", origin)
    ).toContain("/applications/processing-fee/callback?processingFeeId=fee_2");
  });

  it("builds an issuer late-charge callback with a sanitized payment id param", () => {
    expect(
      buildIssuerExcessLateChargeCallbackUrl(
        "pay_abc-1",
        "/financing/notes/note_1",
        "https://issuer.cashsouk.com"
      )
    ).toBe(
      "https://issuer.cashsouk.com/financing/excess-late-charges/callback?excessLateChargeId=pay_abc-1&returnTo=%2Ffinancing%2Fnotes%2Fnote_1"
    );
  });

  it("omits returnTo when it is not provided", () => {
    expect(buildIssuerFacilityFeeCallbackUrl("pay_1", undefined, "https://issuer.example")).toBe(
      "https://issuer.example/financing/facility-fee/callback?facilityFeeId=pay_1"
    );
  });
});
