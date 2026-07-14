import { GatewayPaymentPurpose } from "@prisma/client";
import { assertGatewayAccountMatch, resolveGatewayAccountForPurpose } from "./gateway-account";

describe("resolveGatewayAccountForPurpose", () => {
  it("maps ISSUER_ONBOARDING_FEE to OPERATING", () => {
    expect(resolveGatewayAccountForPurpose(GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE)).toBe(
      "OPERATING"
    );
  });

  it("maps APPLICATION_PROCESSING_FEE to OPERATING", () => {
    expect(resolveGatewayAccountForPurpose(GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE)).toBe(
      "OPERATING"
    );
  });

  it("maps INVESTOR_DEPOSIT to INVESTOR_POOL", () => {
    expect(resolveGatewayAccountForPurpose(GatewayPaymentPurpose.INVESTOR_DEPOSIT)).toBe(
      "INVESTOR_POOL"
    );
  });

  it("fails clearly for unsupported payment purpose", () => {
    expect(() =>
      resolveGatewayAccountForPurpose("UNKNOWN_PURPOSE" as GatewayPaymentPurpose)
    ).toThrow(/Unsupported gateway payment purpose/);
  });

  it("routes only to OPERATING or INVESTOR_POOL", () => {
    const resolved = [
      resolveGatewayAccountForPurpose(GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE),
      resolveGatewayAccountForPurpose(GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE),
      resolveGatewayAccountForPurpose(GatewayPaymentPurpose.INVESTOR_DEPOSIT),
    ];
    expect(new Set(resolved)).toEqual(new Set(["OPERATING", "INVESTOR_POOL"]));
  });

  it("assertGatewayAccountMatch passes for same account", () => {
    expect(() => assertGatewayAccountMatch("OPERATING", "OPERATING", "test")).not.toThrow();
  });

  it("assertGatewayAccountMatch fails for mismatched account", () => {
    expect(() => assertGatewayAccountMatch("OPERATING", "INVESTOR_POOL", "test")).toThrow(
      /GATEWAY_ACCOUNT_MISMATCH|Gateway account mismatch/
    );
  });
});
