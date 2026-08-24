import {
  FACILITY_FEE_DRAWDOWN_BLOCKED_MESSAGE,
  deriveFacilityFeePaymentCardModel,
  deriveFacilityFeeReturnDialogView,
  facilityFeePollIntervalMs,
  hasFacilityFeeUpfrontOutstanding,
  isTerminalFacilityFeeStatus,
  mapFacilityFeeOwnershipError,
  nextFacilityFeeReturnPinState,
  resolveFacilityFeeReturnPaymentId,
} from "./facility-fee-payment-ui";

describe("facility fee payment card state", () => {
  it("shows no CTA when no upfront amount is requested", () => {
    const model = deriveFacilityFeePaymentCardModel({
      upfrontAmount: 0,
      paidAmount: 0,
      outstanding: 0,
    });
    expect(model.state).toBe("none");
    expect(model.ctaLabel).toBeNull();
    expect(model.progressPercent).toBe(100);
  });

  it("asks for the first FPX payment when nothing is credited", () => {
    const model = deriveFacilityFeePaymentCardModel({
      upfrontAmount: 80_000,
      paidAmount: 0,
      outstanding: 80_000,
      perTxnMaxAmount: 30_000,
    });
    expect(model.state).toBe("due");
    expect(model.ctaLabel).toBe("Pay with FPX");
    expect(model.requiresMultiplePayments).toBe(true);
    expect(model.progressPercent).toBe(0);
  });

  it("offers the next payment after a partial credit", () => {
    const model = deriveFacilityFeePaymentCardModel({
      upfrontAmount: 80_000,
      paidAmount: 30_000,
      outstanding: 50_000,
      perTxnMaxAmount: 30_000,
    });
    expect(model.state).toBe("partial");
    expect(model.ctaLabel).toBe("Make next FPX payment");
    expect(model.creditedAmount).toBe(30_000);
    expect(model.progressPercent).toBe(38);
  });

  it("marks the upfront as complete and unlocks drawdowns", () => {
    const model = deriveFacilityFeePaymentCardModel({
      upfrontAmount: 10_000,
      paidAmount: 10_000,
      outstanding: 0,
    });
    expect(model.state).toBe("complete");
    expect(model.ctaLabel).toBeNull();
    expect(model.progressPercent).toBe(100);
  });

  it("hides the CTA while a payment is held for review", () => {
    const model = deriveFacilityFeePaymentCardModel({
      upfrontAmount: 10_000,
      paidAmount: 0,
      outstanding: 10_000,
      paymentStatus: "HELD",
    });
    expect(model.state).toBe("held");
    expect(model.ctaLabel).toBeNull();
  });
});

describe("facility fee poll terminal behavior", () => {
  it("polls every second until a terminal or held status", () => {
    expect(facilityFeePollIntervalMs(undefined, true)).toBe(1000);
    expect(facilityFeePollIntervalMs("CREATED", true)).toBe(1000);
    expect(facilityFeePollIntervalMs("PAID", true)).toBe(1000);
    expect(facilityFeePollIntervalMs("COMPLETED", true)).toBe(false);
    expect(facilityFeePollIntervalMs("HELD", true)).toBe(false);
    expect(facilityFeePollIntervalMs("FAILED", true)).toBe(false);
    expect(facilityFeePollIntervalMs("EXPIRED", true)).toBe(false);
    expect(facilityFeePollIntervalMs("REFUNDED", true)).toBe(false);
    expect(facilityFeePollIntervalMs("CREATED", false)).toBe(false);
    expect(isTerminalFacilityFeeStatus("COMPLETED")).toBe(true);
    expect(isTerminalFacilityFeeStatus("HELD")).toBe(false);
  });
});

describe("facility fee return pin state", () => {
  it("keeps a dismissed pin until a new URL payment id arrives", () => {
    const dismissed = nextFacilityFeeReturnPinState(
      { pinnedPaymentId: "pay_old_12345678", dismissed: true },
      "pay_old_12345678"
    );
    expect(dismissed).toEqual({ pinnedPaymentId: "pay_old_12345678", dismissed: true });
    expect(resolveFacilityFeeReturnPaymentId(dismissed)).toBeNull();

    const nextPayment = nextFacilityFeeReturnPinState(dismissed, "pay_new_12345678");
    expect(nextPayment).toEqual({ pinnedPaymentId: "pay_new_12345678", dismissed: false });
    expect(resolveFacilityFeeReturnPaymentId(nextPayment)).toBe("pay_new_12345678");
  });
});

describe("facility fee return dialog view", () => {
  it("shows the credited aggregate on the final paid view, not only the last payment", () => {
    const view = deriveFacilityFeeReturnDialogView({
      paymentAmount: 3_000,
      paymentStatus: "COMPLETED",
      upfrontAmount: 8_000,
      paidAmount: 8_000,
      outstanding: 0,
    });
    expect(view.phase).toBe("paid");
    expect(view.totalUpfrontPaid).toBe(8_000);
    expect(view.thisPaymentAmount).toBe(3_000);
    expect(view.showThisPaymentVsTotal).toBe(true);
    expect(view.awaitingConfirmation).toBe(false);
  });

  it("keeps partial progress on the credited total while highlighting this payment", () => {
    const view = deriveFacilityFeeReturnDialogView({
      paymentAmount: 5_000,
      paymentStatus: "COMPLETED",
      upfrontAmount: 8_000,
      paidAmount: 5_000,
      outstanding: 3_000,
    });
    expect(view.phase).toBe("partial");
    expect(view.thisPaymentAmount).toBe(5_000);
    expect(view.creditedAmount).toBe(5_000);
    expect(view.outstanding).toBe(3_000);
    expect(view.progressPercent).toBe(63);
  });
});

describe("blocked drawdown copy and ownership errors", () => {
  it("uses the approved issuer message and maps ownership errors", () => {
    expect(FACILITY_FEE_DRAWDOWN_BLOCKED_MESSAGE).toBe(
      "Pay the upfront facility fee to start drawdowns"
    );
    expect(hasFacilityFeeUpfrontOutstanding(1500)).toBe(true);
    expect(hasFacilityFeeUpfrontOutstanding(0)).toBe(false);
    expect(mapFacilityFeeOwnershipError({ code: "CONTRACT_FORBIDDEN" })).toMatch(/not available/i);
    expect(mapFacilityFeeOwnershipError({ code: "FACILITY_FEE_NOT_FOUND" })).toMatch(/not found/i);
  });
});
