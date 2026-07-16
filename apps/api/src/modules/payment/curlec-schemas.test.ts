import { curlecOrderPaymentsSchema, curlecPaymentSchema } from "./curlec-schemas";

describe("curlecPaymentSchema fee/tax nullability", () => {
  const basePayment = {
    id: "pay_test",
    amount: 15000,
    currency: "MYR",
    status: "failed",
  };

  it("accepts fee: null and tax: null", () => {
    const parsed = curlecPaymentSchema.parse({
      ...basePayment,
      fee: null,
      tax: null,
    });

    expect(parsed.fee).toBeNull();
    expect(parsed.tax).toBeNull();
  });

  it("accepts missing fee and tax", () => {
    const parsed = curlecPaymentSchema.parse(basePayment);

    expect(parsed.fee).toBeUndefined();
    expect(parsed.tax).toBeUndefined();
  });

  it("accepts numeric fee and tax", () => {
    const parsed = curlecPaymentSchema.parse({
      ...basePayment,
      status: "captured",
      fee: 100,
      tax: 0,
    });

    expect(parsed.fee).toBe(100);
    expect(parsed.tax).toBe(0);
  });

  it("parses order payments with a failed null-fee attempt and a captured attempt", () => {
    const parsed = curlecOrderPaymentsSchema.parse({
      entity: "collection",
      count: 2,
      items: [
        {
          id: "pay_failed",
          amount: 15000,
          currency: "MYR",
          status: "failed",
          order_id: "order_test",
          fee: null,
          tax: null,
          created_at: 100,
        },
        {
          id: "pay_captured",
          amount: 15000,
          currency: "MYR",
          status: "captured",
          order_id: "order_test",
          fee: 100,
          tax: 0,
          created_at: 200,
        },
      ],
    });

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]?.fee).toBeNull();
    expect(parsed.items[1]?.status).toBe("captured");
  });
});
