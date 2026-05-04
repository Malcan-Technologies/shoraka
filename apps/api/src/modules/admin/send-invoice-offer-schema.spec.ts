import { sendInvoiceOfferSchema } from "./schemas";

describe("sendInvoiceOfferSchema", () => {
  const base = {
    offeredAmount: 1000,
    offeredRatioPercent: 70,
    offeredProfitRatePercent: 12,
    expiresAt: null as string | null,
  };

  it("fails when risk_rating is missing", () => {
    const parsed = sendInvoiceOfferSchema.safeParse(base);
    expect(parsed.success).toBe(false);
  });

  it("fails when risk_rating is outside Soukscore grades", () => {
    const parsed = sendInvoiceOfferSchema.safeParse({ ...base, risk_rating: "ZZ" });
    expect(parsed.success).toBe(false);
  });

  it("passes with risk_rating AAA", () => {
    const parsed = sendInvoiceOfferSchema.safeParse({ ...base, risk_rating: "AAA" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.risk_rating).toBe("AAA");
    }
  });

  it("passes with risk_rating B", () => {
    const parsed = sendInvoiceOfferSchema.safeParse({ ...base, risk_rating: "B" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.risk_rating).toBe("B");
    }
  });
});
