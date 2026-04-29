import {
  calculateLateCharge,
  calculateSettlementWaterfall,
  meetsMinimumFunding,
} from "./calculators";

describe("note lifecycle calculators", () => {
  it("enforces the minimum funding threshold", () => {
    expect(meetsMinimumFunding(80_000, 100_000)).toBe(true);
    expect(meetsMinimumFunding(79_999, 100_000)).toBe(false);
  });

  it("splits settlement into investor, service fee, syariah, and issuer residual buckets", () => {
    const result = calculateSettlementWaterfall({
      grossReceiptAmount: 100_000,
      fundedPrincipal: 60_000,
      profitRatePercent: 10,
      serviceFeeRatePercent: 15,
      tawidhAmount: 200,
      gharamahAmount: 300,
    });

    expect(result.investorPrincipal).toBe(60_000);
    expect(result.investorProfitGross).toBe(6_000);
    expect(result.serviceFeeAmount).toBe(900);
    expect(result.investorProfitNet).toBe(5_100);
    expect(result.tawidhAmount).toBe(200);
    expect(result.gharamahAmount).toBe(300);
    expect(result.issuerResidualAmount).toBe(33_500);
  });

  it("caps manually entered ta'widh and gharamah at configured rates after grace period", () => {
    const result = calculateLateCharge({
      receiptAmount: 100_000,
      dueDate: new Date("2026-01-01T00:00:00.000Z"),
      receiptDate: new Date("2026-01-18T00:00:00.000Z"),
      gracePeriodDays: 7,
      tawidhRateCapPercent: 1,
      gharamahRateCapPercent: 9,
      tawidhAmount: 999,
      gharamahAmount: 999,
    });

    expect(result.daysLate).toBe(10);
    expect(result.tawidhAmount).toBeCloseTo(27.3972, 4);
    expect(result.gharamahAmount).toBeCloseTo(246.5753, 4);
  });
});

