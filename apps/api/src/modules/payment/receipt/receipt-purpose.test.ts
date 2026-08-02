import { GatewayPaymentPurpose } from "@prisma/client";
import {
  getReceiptPurposeLabel,
  getReceiptRelatedEntityType,
} from "./receipt-purpose";

describe("receipt-purpose", () => {
  it("maps issuer onboarding fee to Issuer Registration Fee", () => {
    expect(getReceiptPurposeLabel(GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE)).toBe(
      "Issuer Registration Fee"
    );
    expect(getReceiptRelatedEntityType(GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE)).toBe(
      "ISSUER_ORGANIZATION"
    );
  });

  it("maps application processing fee", () => {
    expect(getReceiptPurposeLabel(GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE)).toBe(
      "Application Processing Fee"
    );
    expect(
      getReceiptRelatedEntityType(GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE)
    ).toBe("APPLICATION");
  });

  it("maps investor deposit", () => {
    expect(getReceiptPurposeLabel(GatewayPaymentPurpose.INVESTOR_DEPOSIT)).toBe(
      "Investor Deposit"
    );
    expect(getReceiptRelatedEntityType(GatewayPaymentPurpose.INVESTOR_DEPOSIT)).toBe(
      "INVESTOR_ORGANIZATION"
    );
  });
});
