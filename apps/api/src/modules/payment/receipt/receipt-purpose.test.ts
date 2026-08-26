import { GatewayPaymentPurpose } from "@prisma/client";
import {
  getReceiptPurposeLabel,
  getReceiptRelatedEntityType,
  getReceiptRelatedReferenceLabel,
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

  it("maps facility fee", () => {
    expect(getReceiptPurposeLabel(GatewayPaymentPurpose.FACILITY_FEE)).toBe("Facility Fee");
    expect(getReceiptRelatedEntityType(GatewayPaymentPurpose.FACILITY_FEE)).toBe("CONTRACT");
    expect(getReceiptRelatedReferenceLabel(GatewayPaymentPurpose.FACILITY_FEE)).toBe(
      "Facility Reference"
    );
  });

  it("maps excess late charges to the note", () => {
    expect(getReceiptPurposeLabel(GatewayPaymentPurpose.EXCESS_LATE_CHARGES)).toBe(
      "Late Payment Charges"
    );
    expect(getReceiptRelatedEntityType(GatewayPaymentPurpose.EXCESS_LATE_CHARGES)).toBe("NOTE");
    expect(getReceiptRelatedReferenceLabel(GatewayPaymentPurpose.EXCESS_LATE_CHARGES)).toBe(
      "Note Reference"
    );
  });

  it("maps investor deposit", () => {
    expect(getReceiptPurposeLabel(GatewayPaymentPurpose.INVESTOR_DEPOSIT)).toBe(
      "Investor Deposit"
    );
    expect(getReceiptRelatedEntityType(GatewayPaymentPurpose.INVESTOR_DEPOSIT)).toBe(
      "INVESTOR_ORGANIZATION"
    );
  });

  it("uses finance-friendly related reference labels (not Curlec dep_/fee_/pf_)", () => {
    expect(
      getReceiptRelatedReferenceLabel(GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE)
    ).toBe("Application Reference");
    expect(getReceiptRelatedReferenceLabel(GatewayPaymentPurpose.INVESTOR_DEPOSIT)).toBeNull();
    expect(
      getReceiptRelatedReferenceLabel(GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE)
    ).toBe("Issuer Reference");
  });
});
