import {
  deriveExcessLateChargePaymentCardModel,
  deriveExcessLateChargeReturnDialogView,
  mapExcessLateChargeOwnershipError,
  nextExcessLateChargeReturnPinState,
} from "./excess-late-charge-payment-ui";

describe("excess late charge payment UI", () => {
  it("asks the issuer to pay when charges are outstanding", () => {
    const model = deriveExcessLateChargePaymentCardModel({
      owedAmount: 400,
      paidAmount: 0,
      outstanding: 400,
      noteReference: "NOTE-1",
      perTxnMaxAmount: 30000,
    });
    expect(model.state).toBe("due");
    expect(model.title).toBe("Pay outstanding late charges");
    expect(model.description).toContain("NOTE-1");
    expect(model.ctaLabel).toBe("Pay with FPX");
  });

  it("flags multi-transaction caps and held review", () => {
    expect(
      deriveExcessLateChargePaymentCardModel({
        owedAmount: 40000,
        paidAmount: 0,
        outstanding: 40000,
        noteReference: "NOTE-1",
        perTxnMaxAmount: 30000,
      }).requiresMultiplePayments
    ).toBe(true);
    expect(
      deriveExcessLateChargePaymentCardModel({
        owedAmount: 400,
        paidAmount: 0,
        outstanding: 400,
        noteReference: "NOTE-1",
        held: true,
      }).state
    ).toBe("held");
  });

  it("maps ownership errors and pins a new return payment id", () => {
    expect(mapExcessLateChargeOwnershipError({ code: "NOTE_FORBIDDEN" })).toContain(
      "do not have access"
    );
    expect(
      nextExcessLateChargeReturnPinState(
        { pinnedPaymentId: null, dismissed: true },
        "pay_1"
      )
    ).toEqual({ pinnedPaymentId: "pay_1", dismissed: false });
  });

  it("shows a partial return dialog when more is still owed", () => {
    const view = deriveExcessLateChargeReturnDialogView({
      paymentAmount: 10000,
      paymentStatus: "COMPLETED",
      owedAmount: 40000,
      paidAmount: 35000,
      outstanding: 5000,
      noteReference: "NOTE-1",
      perTxnMaxAmount: 30000,
    });
    expect(view.phase).toBe("partial");
    expect(view.showThisPaymentVsTotal).toBe(true);
  });
});
