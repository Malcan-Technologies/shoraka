import {
  GATEWAY_PAYMENT_EXCEPTIONS_FILTER,
  GATEWAY_PAYMENT_EXCEPTIONS_PURPOSE,
  GATEWAY_PAYMENT_EXCEPTIONS_STATUSES,
  GATEWAY_PAYMENT_LIST_FILTERS,
  isGatewayPaymentException,
} from "./gateway-payments";

describe("gateway payment exceptions filter", () => {
  it("exports exceptions as a list filter without replacing HELD-only or review", () => {
    expect(GATEWAY_PAYMENT_LIST_FILTERS).toEqual([
      "exceptions",
      "needs_attention",
      "review",
      "refunding",
      "refunded",
      "completed",
    ]);
    expect(GATEWAY_PAYMENT_EXCEPTIONS_FILTER).toBe("exceptions");
    expect(GATEWAY_PAYMENT_EXCEPTIONS_PURPOSE).toBe("INVESTOR_DEPOSIT");
    expect(GATEWAY_PAYMENT_EXCEPTIONS_STATUSES).toEqual(["HELD", "NAME_CHECK_PENDING"]);
  });

  it("matches only investor deposits that are HELD or NAME_CHECK_PENDING", () => {
    const rows = [
      { purpose: "INVESTOR_DEPOSIT", status: "HELD" },
      { purpose: "INVESTOR_DEPOSIT", status: "NAME_CHECK_PENDING" },
      { purpose: "INVESTOR_DEPOSIT", status: "COMPLETED" },
      { purpose: "INVESTOR_DEPOSIT", status: "REFUND_INITIATED" },
      { purpose: "FACILITY_FEE", status: "HELD" },
      { purpose: "FACILITY_FEE", status: "NAME_CHECK_PENDING" },
      { purpose: "ISSUER_ONBOARDING_FEE", status: "HELD" },
      { purpose: "APPLICATION_PROCESSING_FEE", status: "NAME_CHECK_PENDING" },
      { purpose: "EXCESS_LATE_CHARGES", status: "HELD" },
    ];

    expect(rows.filter(isGatewayPaymentException)).toEqual([
      { purpose: "INVESTOR_DEPOSIT", status: "HELD" },
      { purpose: "INVESTOR_DEPOSIT", status: "NAME_CHECK_PENDING" },
    ]);
  });
});
