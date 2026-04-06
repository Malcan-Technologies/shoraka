import {
  computeNetWorth,
  computeTurnoverGrowth,
  computeProfitMargin,
  computeTotalAssets,
} from "@cashsouk/types";

describe("computeTurnoverGrowth", () => {
  it("returns ratio when prior year is exactly one less than target", () => {
    const g = computeTurnoverGrowth({
      targetYear: 2025,
      targetTurnover: 120,
      priorYear: 2024,
      priorTurnover: 100,
    });
    expect(g).toBeCloseTo(0.2);
  });

  it("returns null when prior year is not consecutive", () => {
    const g = computeTurnoverGrowth({
      targetYear: 2025,
      targetTurnover: 120,
      priorYear: 2023,
      priorTurnover: 100,
    });
    expect(g).toBeNull();
  });

  it("returns null when prior turnover is zero", () => {
    const g = computeTurnoverGrowth({
      targetYear: 2025,
      targetTurnover: 120,
      priorYear: 2024,
      priorTurnover: 0,
    });
    expect(g).toBeNull();
  });
});

describe("computeProfitMargin", () => {
  it("returns null when turnover is zero", () => {
    expect(computeProfitMargin(100, 0)).toBeNull();
  });

  it("returns pat/turnover when valid", () => {
    expect(computeProfitMargin(50, 200)).toBeCloseTo(0.25);
  });
});

describe("computeTotalAssets", () => {
  it("uses reported total when set", () => {
    expect(
      computeTotalAssets({
        total_assets: 999,
        fixed_assets: 1,
        other_assets: 2,
        current_assets: 3,
        non_current_assets: 4,
      })
    ).toBe(999);
  });
});

describe("computeNetWorth", () => {
  it("is total assets minus total liabilities", () => {
    expect(computeNetWorth(100, 40)).toBe(60);
    expect(computeNetWorth(100, 100)).toBe(0);
  });
});
