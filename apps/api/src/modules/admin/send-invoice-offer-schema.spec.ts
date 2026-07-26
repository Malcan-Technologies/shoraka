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

  it("fails when risk_rating is a legacy AAA–BB grade or otherwise outside A–F", () => {
    for (const risk_rating of ["AAA", "AA", "BBB", "BB", "A-", "G", "Low Risk"]) {
      const parsed = sendInvoiceOfferSchema.safeParse({ ...base, risk_rating });
      expect(parsed.success).toBe(false);
    }
  });

  it.each(["A", "B", "C", "D", "E", "F"] as const)(
    "passes with risk_rating %s",
    (risk_rating) => {
      const parsed = sendInvoiceOfferSchema.safeParse({ ...base, risk_rating });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.risk_rating).toBe(risk_rating);
      }
    }
  );

  it("allows platformFeeRatePercent above the default cap for service-level validation", () => {
    const parsed = sendInvoiceOfferSchema.safeParse({
      ...base,
      risk_rating: "A",
      platformFeeRatePercent: 3.01,
    });
    expect(parsed.success).toBe(true);
  });

  it("passes with platformFeeRatePercent at cap", () => {
    const parsed = sendInvoiceOfferSchema.safeParse({
      ...base,
      risk_rating: "A",
      platformFeeRatePercent: 3,
    });
    expect(parsed.success).toBe(true);
  });
});
