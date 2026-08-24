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

describe("sendInvoiceOfferSchema fee schedule", () => {
  const base = {
    offeredAmount: 1000,
    offeredRatioPercent: 70,
    offeredProfitRatePercent: 12,
    risk_rating: "A",
  };

  it("defaults collect amount and additional fees", () => {
    const parsed = sendInvoiceOfferSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.facilityFeeCollectAmount).toBe(0);
      expect(parsed.data.additionalFees).toEqual([]);
    }
  });

  it("rejects duplicate additional fee names and over-precise amounts", () => {
    expect(
      sendInvoiceOfferSchema.safeParse({
        ...base,
        additionalFees: [
          { name: "Legal", kind: "amount", value: 10 },
          { name: "legal", kind: "amount", value: 5 },
        ],
      }).success
    ).toBe(false);
    expect(
      sendInvoiceOfferSchema.safeParse({
        ...base,
        facilityFeeCollectAmount: 1.001,
      }).success
    ).toBe(false);
  });

  it("accepts named amount and percent lines", () => {
    const parsed = sendInvoiceOfferSchema.safeParse({
      ...base,
      facilityFeeCollectAmount: 25.5,
      additionalFees: [
        { name: "Legal fee", kind: "amount", value: 100 },
        { name: "Arrangement", kind: "percent_of_funded", value: 0.5 },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts explicit v1 and preserve_grandfather modes and rejects unknown modes", () => {
    expect(
      sendInvoiceOfferSchema.safeParse({ ...base, feeScheduleMode: "v1" }).success
    ).toBe(true);
    expect(
      sendInvoiceOfferSchema.safeParse({ ...base, feeScheduleMode: "preserve_grandfather" })
        .success
    ).toBe(true);
    expect(
      sendInvoiceOfferSchema.safeParse({ ...base, feeScheduleMode: "grandfather" }).success
    ).toBe(false);
  });

  it("does not default feeScheduleMode so the service can infer grandfather preserve", () => {
    const parsed = sendInvoiceOfferSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.feeScheduleMode).toBeUndefined();
    }
  });
});
