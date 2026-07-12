import { GatewayPaymentPurpose } from "@prisma/client";
import { resolveGatewayAccountForPurpose } from "./gateway-account";

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

  it("does not route any supported purpose to LEGACY_DEFAULT", () => {
    const resolved = [
      resolveGatewayAccountForPurpose(GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE),
      resolveGatewayAccountForPurpose(GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE),
      resolveGatewayAccountForPurpose(GatewayPaymentPurpose.INVESTOR_DEPOSIT),
    ];
    expect(resolved).not.toContain("LEGACY_DEFAULT");
  });
});
