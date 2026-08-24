import {
  invoiceAmountFromFaceAndRatio,
  invoiceOfferExceedsRequested,
  resolveRequestedInvoiceAmount,
} from "./invoice-offer";

describe("resolveRequestedInvoiceAmount", () => {
  it("keeps sen instead of rounding requested financing to whole ringgit", () => {
    expect(
      resolveRequestedInvoiceAmount({
        value: 80_527.92,
        financing_ratio_percent: 79,
      })
    ).toBe(63_617.06);
  });

  it("sen-rounds a stored applied_financing value", () => {
    expect(
      resolveRequestedInvoiceAmount({
        applied_financing: 63_617.0568,
      })
    ).toBe(63_617.06);
  });
});

describe("invoiceAmountFromFaceAndRatio", () => {
  it("matches the admin offer amount for 79% of RM 80,527.92", () => {
    expect(invoiceAmountFromFaceAndRatio(80_527.92, 79)).toBe(63_617.06);
  });
});

describe("invoiceOfferExceedsRequested", () => {
  it("allows an offer that matches the request at sen precision", () => {
    expect(invoiceOfferExceedsRequested(63_617.06, 63_617.0568)).toBe(false);
    expect(invoiceOfferExceedsRequested(63_617.06000000001, 63_617.06)).toBe(false);
  });

  it("rejects an offer one sen above the request", () => {
    expect(invoiceOfferExceedsRequested(63_617.07, 63_617.06)).toBe(true);
  });
});
