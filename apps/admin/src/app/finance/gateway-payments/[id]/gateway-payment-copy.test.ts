import {
  formatAmountMismatchDescription,
  formatGatewayEventDescription,
  formatGatewayEventTitle,
  formatGatewayPaymentFailureReason,
  hasUncertainAmountMismatchRefund,
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
    expect(formatGatewayEventTitle("PAYMENT_CAPTURE_MISMATCH_DETECTED", "CURRENCY_MISMATCH")).toBe(
      "Currency mismatch found"
    );
    expect(formatGatewayEventTitle("PAYMENT_CAPTURE_MISMATCH_DETECTED", "AMOUNT_MISMATCH")).toBe(
      "Amount mismatch found"
    );
    expect(formatGatewayEventTitle("PAYMENT_REFUND_WALLET_REVERSAL_FAILED")).toBe(
      "Wallet balance could not be updated"
    );
    expect(formatGatewayEventTitle("PAYMENT_REFUND_INITIATED")).toBe("Refund requested");
  });

  it("maps known reasons to plain descriptions", () => {
    expect(
      formatGatewayEventDescription(
        "PAYMENT_REFUND_INITIATED",
        "External Curlec refund detected on completed payment"
      )
    ).toBe("A refund was detected from Curlec on a completed payment.");
  });

  it("builds amount mismatch descriptions from real sen amounts", () => {
    const formatSen = (sen: number) => `RM${(sen / 100).toFixed(2)}`;

    expect(
      formatAmountMismatchDescription({
        expectedSen: 15000,
        receivedSen: 99999,
        state: "pending",
        formatSen,
      })
    ).toBe(
      "RM999.99 was received instead of RM150.00. A full refund of RM999.99 has been requested and is waiting for Curlec’s confirmation."
    );

    expect(
      formatAmountMismatchDescription({
        expectedSen: 15000,
        receivedSen: 99999,
        state: "completed",
        formatSen,
      })
    ).toBe(
      "RM999.99 was received instead of RM150.00. A full refund of RM999.99 has been completed."
    );

    expect(
      formatAmountMismatchDescription({
        expectedSen: 10000,
        receivedSen: 15000,
        state: "failed",
        formatSen,
      })
    ).toBe(
      "RM150.00 was received instead of RM100.00. A full refund of RM150.00 could not be completed and requires attention."
    );

    expect(
      formatAmountMismatchDescription({
        expectedSen: 10000,
        receivedSen: 15000,
        state: "uncertain",
        formatSen,
      })
    ).toBe(
      "RM150.00 was received instead of RM100.00. A full refund of RM150.00 was requested, but the result has not yet been confirmed."
    );
  });

  it("detects uncertain refund request from autoRefundFailed metadata", () => {
    expect(hasUncertainAmountMismatchRefund({ autoRefundFailed: { at: "now" } })).toBe(
      true
    );
    expect(hasUncertainAmountMismatchRefund({})).toBe(false);
  });
});
