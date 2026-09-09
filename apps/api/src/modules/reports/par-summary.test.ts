import { summarizePortfolioAtRisk } from "./par-summary";

describe("summarizePortfolioAtRisk", () => {
  const rows = [
    { daysPastDue: 0, servicingStatus: "CURRENT", outstandingPrincipal: 100, outstandingProfit: 0 },
    { daysPastDue: 12, servicingStatus: "OVERDUE", outstandingPrincipal: 40, outstandingProfit: 10 },
    { daysPastDue: 45, servicingStatus: "LATE", outstandingPrincipal: 30, outstandingProfit: 0 },
    { daysPastDue: 75, servicingStatus: "ARREARS", outstandingPrincipal: 20, outstandingProfit: 0 },
    { daysPastDue: 110, servicingStatus: "DEFAULTED", outstandingPrincipal: 25, outstandingProfit: 5 },
  ];

  it("uses cumulative PAR thresholds and remaining outstanding", () => {
    const summary = summarizePortfolioAtRisk(rows, "2026-09-09");
    expect(summary.bookCount).toBe(5);
    expect(summary.bookOutstanding).toBe(230);
    expect(summary.pastDue).toEqual({ count: 4, amount: 130, percent: (130 / 230) * 100 });
    expect(summary.par30).toEqual({ count: 3, amount: 80, percent: (80 / 230) * 100 });
    expect(summary.par60).toEqual({ count: 2, amount: 50, percent: (50 / 230) * 100 });
    expect(summary.par90).toEqual({ count: 1, amount: 30, percent: (30 / 230) * 100 });
    expect(summary.defaulted).toEqual({ count: 1, amount: 30, percent: (30 / 230) * 100 });
    expect(summary.exclusive).toEqual({
      current: { count: 1, amount: 100, percent: (100 / 230) * 100 },
      dpd1To30: { count: 1, amount: 50, percent: (50 / 230) * 100 },
      dpd31To60: { count: 1, amount: 30, percent: (30 / 230) * 100 },
      dpd61To90: { count: 1, amount: 20, percent: (20 / 230) * 100 },
      dpd90Plus: { count: 1, amount: 30, percent: (30 / 230) * 100 },
    });
  });

  it("places DPD band edges in exclusive buckets", () => {
    const summary = summarizePortfolioAtRisk(
      [
        { daysPastDue: 30, outstandingPrincipal: 10, outstandingProfit: 0 },
        { daysPastDue: 31, outstandingPrincipal: 20, outstandingProfit: 0 },
        { daysPastDue: 60, outstandingPrincipal: 30, outstandingProfit: 0 },
        { daysPastDue: 61, outstandingPrincipal: 40, outstandingProfit: 0 },
        { daysPastDue: 90, outstandingPrincipal: 50, outstandingProfit: 0 },
        { daysPastDue: 91, outstandingPrincipal: 60, outstandingProfit: 0 },
      ],
      "2026-09-09"
    );
    expect(summary.exclusive.dpd1To30).toEqual({ count: 1, amount: 10, percent: (10 / 210) * 100 });
    expect(summary.exclusive.dpd31To60).toEqual({ count: 2, amount: 50, percent: (50 / 210) * 100 });
    expect(summary.exclusive.dpd61To90).toEqual({ count: 2, amount: 90, percent: (90 / 210) * 100 });
    expect(summary.exclusive.dpd90Plus).toEqual({ count: 1, amount: 60, percent: (60 / 210) * 100 });
  });

  it("returns zeroes when the book is empty", () => {
    const zero = { count: 0, amount: 0, percent: 0 };
    expect(summarizePortfolioAtRisk([], "2026-09-09")).toEqual({
      asOf: "2026-09-09",
      bookCount: 0,
      bookOutstanding: 0,
      pastDue: zero,
      par30: zero,
      par60: zero,
      par90: zero,
      defaulted: zero,
      exclusive: {
        current: zero,
        dpd1To30: zero,
        dpd31To60: zero,
        dpd61To90: zero,
        dpd90Plus: zero,
      },
    });
  });
});
