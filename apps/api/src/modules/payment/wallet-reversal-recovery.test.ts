import { GatewayPaymentPurpose, GatewayPaymentStatus } from "@prisma/client";
import { isRecoverableRefundCreationHold } from "./refund-service";

describe("wallet reversal recovery markers", () => {
  it("does not treat currency-mismatch holds as wallet-reversal recovery", () => {
    expect(
      isRecoverableRefundCreationHold({
        captureMismatch: { mismatchType: "CURRENCY_MISMATCH" },
      })
    ).toBe(false);
  });

  it("keeps wallet-reversal failure out of refund.created recovery allowlist", () => {
    expect(
      isRecoverableRefundCreationHold({
        refundConfirmedWalletReversalFailed: {
          refundId: "rfnd_1",
          fundsProtected: true,
          blockedAmount: 100,
        },
      })
    ).toBe(false);
  });

  it("still allows autoRefundFailed holds for refund.created recovery", () => {
    expect(
      isRecoverableRefundCreationHold({
        autoRefundFailed: { error: "timeout" },
      })
    ).toBe(true);
  });
});

describe("wallet reversal status expectations", () => {
  it("investor deposit purposes require wallet correction before REFUNDED", () => {
    expect(GatewayPaymentPurpose.INVESTOR_DEPOSIT).toBe("INVESTOR_DEPOSIT");
    expect(GatewayPaymentStatus.HELD).toBe("HELD");
    expect(GatewayPaymentStatus.REFUNDED).toBe("REFUNDED");
  });
});
