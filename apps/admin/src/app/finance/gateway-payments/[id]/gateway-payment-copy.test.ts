import {
  formatGatewayEventDescription,
  formatGatewayEventTitle,
  formatGatewayPaymentFailureReason,
} from "./gateway-payment-copy";

describe("gateway payment admin copy", () => {
  it("formats insufficient balance errors in plain English", () => {
    expect(
      formatGatewayPaymentFailureReason(
        "Insufficient available balance (available 10.00, required 100.00)"
      )
    ).toBe(
      "Only RM10.00 was available, but RM100.00 needed to be removed from the wallet."
    );
  });

  it("uses plain activity titles for mismatch and wallet events", () => {
    expect(formatGatewayEventTitle("CAPTURE_MISMATCH", "Currency mismatch")).toBe(
      "Currency mismatch found"
    );
    expect(formatGatewayEventTitle("CAPTURE_MISMATCH", "AMOUNT_MISMATCH")).toBe(
      "Amount mismatch found"
    );
    expect(formatGatewayEventTitle("REFUND_WALLET_REVERSAL_FAILED")).toBe(
      "Wallet balance could not be updated"
    );
    expect(formatGatewayEventTitle("REFUND_INITIATED")).toBe("Refund requested");
  });

  it("maps known reasons to plain descriptions", () => {
    expect(
      formatGatewayEventDescription(
        "REFUND_INITIATED",
        "External Curlec refund detected on completed payment"
      )
    ).toBe("A refund was detected from Curlec on a completed payment.");
  });
});
