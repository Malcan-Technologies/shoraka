jest.mock("../../lib/prisma", () => ({ prisma: {} }));

import { GatewayPaymentPurpose, NoteLedgerAccountType, NoteLedgerDirection } from "@prisma/client";
import {
  classifyTrustMovement,
  ledgerClosing,
  ledgerSignedBalance,
} from "./trust-revenue";

describe("trust revenue classification", () => {
  it("classifies posted operating fees from ledger, not estimates", () => {
    expect(
      classifyTrustMovement({
        accountCode: NoteLedgerAccountType.OPERATING_ACCOUNT,
        direction: NoteLedgerDirection.CREDIT,
        description: "Drawdown fee deducted at disbursement",
        settlementId: null,
        gatewayPurpose: null,
      })
    ).toBe("drawdown");
    expect(
      classifyTrustMovement({
        accountCode: NoteLedgerAccountType.OPERATING_ACCOUNT,
        direction: NoteLedgerDirection.CREDIT,
        description: "Service fee retained at settlement",
        settlementId: "stl-1",
        gatewayPurpose: null,
      })
    ).toBe("service_fee");
    expect(
      classifyTrustMovement({
        accountCode: NoteLedgerAccountType.OPERATING_ACCOUNT,
        direction: NoteLedgerDirection.CREDIT,
        description: "Issuer onboarding fee",
        settlementId: null,
        gatewayPurpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      })
    ).toBe("onboarding");
  });

  it("keeps residual, Ta'widh, and Gharamah separate from revenue", () => {
    expect(
      classifyTrustMovement({
        accountCode: NoteLedgerAccountType.ISSUER_PAYABLE,
        direction: NoteLedgerDirection.CREDIT,
        description: "Issuer residual",
        settlementId: "stl-1",
        gatewayPurpose: null,
      })
    ).toBe("issuer_residual");
    expect(
      classifyTrustMovement({
        accountCode: NoteLedgerAccountType.TAWIDH_ACCOUNT,
        direction: NoteLedgerDirection.CREDIT,
        description: "Ta'widh",
        settlementId: "stl-1",
        gatewayPurpose: null,
      })
    ).toBe("tawidh");
  });

  it("computes opening plus period as closing without adding summaries", () => {
    const opening = ledgerSignedBalance(100, 40);
    const closing = ledgerClosing(opening, 25, 10);
    expect(opening).toBe(60);
    expect(closing).toBe(75);
    const serviceFeeSummary = 25;
    expect(closing).not.toBe(opening + serviceFeeSummary);
  });
});
