import {
  estimateTenureLateFeeHeadroom,
  formatProfitAccruedCopy,
  formatUtcCalendarDay,
  profitWindowClassificationLabel,
} from "./tenure-profit";

describe("estimateTenureLateFeeHeadroom", () => {
  it("uses the RM100k / RM80k ceiling so remaining headroom can reach zero", () => {
    expect(
      estimateTenureLateFeeHeadroom({
        settlementAmount: 100_000,
        fundedPrincipal: 80_000,
        annualRatePercent: 50,
        profitDays: 365,
        invoiceFaceValue: 100_000,
      })
    ).toBe(0);
  });

  it("returns invoice leftover after uncapped profit below the ceiling", () => {
    expect(
      estimateTenureLateFeeHeadroom({
        settlementAmount: 100_000,
        fundedPrincipal: 80_000,
        annualRatePercent: 10,
        profitDays: 365,
        invoiceFaceValue: 100_000,
      })
    ).toBe(12_000);
  });
});

describe("profit accrued copy", () => {
  it("formats the waterfall profit window without a timezone shift", () => {
    expect(formatUtcCalendarDay("2026-08-20T00:00:00.000Z")).toBe("20 Aug 2026");
    expect(
      formatProfitAccruedCopy({
        startDate: "2026-08-20T00:00:00.000Z",
        endDate: "2026-11-01T00:00:00.000Z",
        profitDays: 73,
      })
    ).toBe("Profit accrued: 20 Aug 2026 – 1 Nov 2026 (73 days)");
    expect(profitWindowClassificationLabel("GRACE")).toBe("Settled in grace");
  });
});
