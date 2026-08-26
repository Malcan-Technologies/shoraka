import {
  DEFAULT_MIN_INVOICE_FINANCING_RATIO_PERCENT,
  INVOICE_FINANCING_RATIO_CAP_MESSAGE,
  MAX_INVOICE_FINANCING_RATIO_PERCENT,
  effectiveInvoiceFinancingRatioMax,
  invoiceFinancingExceedsMaxRatio,
  invoiceFinancingRatioFromAmount,
  resolveInvoiceFinancingRatioBounds,
} from "./invoice-financing-ratio";

describe("invoice financing ratio cap", () => {
  it("is 80 percent with a human-readable cap message", () => {
    expect(MAX_INVOICE_FINANCING_RATIO_PERCENT).toBe(80);
    expect(DEFAULT_MIN_INVOICE_FINANCING_RATIO_PERCENT).toBe(60);
    expect(INVOICE_FINANCING_RATIO_CAP_MESSAGE).toBe(
      "Financing cannot exceed 80% of the invoice value."
    );
  });

  it("clamps a stale product max to 80 and preserves a lower product max", () => {
    expect(effectiveInvoiceFinancingRatioMax(100)).toBe(80);
    expect(effectiveInvoiceFinancingRatioMax(90)).toBe(80);
    expect(effectiveInvoiceFinancingRatioMax(80)).toBe(80);
    expect(effectiveInvoiceFinancingRatioMax(70)).toBe(70);
    expect(effectiveInvoiceFinancingRatioMax(null)).toBe(80);
    expect(effectiveInvoiceFinancingRatioMax(undefined)).toBe(80);
  });

  it("resolves issuer slider bounds so a 100% product max cannot raise the slider", () => {
    expect(resolveInvoiceFinancingRatioBounds(60, 100)).toEqual({ min: 60, max: 80 });
    expect(resolveInvoiceFinancingRatioBounds(70, 70)).toEqual({ min: 70, max: 70 });
    expect(resolveInvoiceFinancingRatioBounds(85, 100)).toEqual({ min: 80, max: 80 });
    expect(resolveInvoiceFinancingRatioBounds(null, null)).toEqual({ min: 60, max: 80 });
  });

  it("accepts 80% of face and rejects 80.01 / 81 / 100 and amount bypasses", () => {
    expect(invoiceFinancingRatioFromAmount(80_000, 100_000)).toBe(80);
    expect(
      invoiceFinancingExceedsMaxRatio({
        offeredAmount: 80_000,
        invoiceFace: 100_000,
        offeredRatioPercent: 80,
      })
    ).toBe(false);
    expect(
      invoiceFinancingExceedsMaxRatio({
        offeredAmount: 80_010,
        invoiceFace: 100_000,
        offeredRatioPercent: 80.01,
      })
    ).toBe(true);
    expect(
      invoiceFinancingExceedsMaxRatio({
        offeredAmount: 81_000,
        invoiceFace: 100_000,
        offeredRatioPercent: 81,
      })
    ).toBe(true);
    expect(
      invoiceFinancingExceedsMaxRatio({
        offeredAmount: 100_000,
        invoiceFace: 100_000,
        offeredRatioPercent: 100,
      })
    ).toBe(true);
    expect(
      invoiceFinancingExceedsMaxRatio({
        offeredAmount: 81_000,
        invoiceFace: 100_000,
        offeredRatioPercent: null,
      })
    ).toBe(true);
    expect(
      invoiceFinancingExceedsMaxRatio({
        offeredAmount: 81_000,
        invoiceFace: 100_000,
        offeredRatioPercent: 70,
      })
    ).toBe(true);
    expect(
      invoiceFinancingExceedsMaxRatio({
        offeredAmount: 70_000,
        invoiceFace: 100_000,
        offeredRatioPercent: 81,
      })
    ).toBe(true);
  });

  it("allows a sen-rounded 80% of a face that is not an exact sen", () => {
    expect(
      invoiceFinancingExceedsMaxRatio({
        offeredAmount: 64_422.34,
        invoiceFace: 80_527.92,
        offeredRatioPercent: 80,
      })
    ).toBe(false);
  });
});
