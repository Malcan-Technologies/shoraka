import {
  computeNetWorth,
  computeTurnoverGrowth,
  computeProfitMargin,
  computeTotalAssets,
  computeTotalAssetsIfComplete,
  computeTotalLiabilities,
  computeTotalLiabilitiesIfComplete,
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

  it("zero-defaults missing components for Admin compatibility", () => {
    expect(
      computeTotalAssets({
        total_assets: null,
        fixed_assets: null,
        other_assets: null,
        current_assets: 100,
        non_current_assets: null,
      })
    ).toBe(100);
  });
});

describe("computeTotalAssetsIfComplete", () => {
  it("sums when all components are present including legitimate zeros", () => {
    expect(
      computeTotalAssetsIfComplete({
        total_assets: null,
        fixed_assets: 1_500_000,
        other_assets: 0,
        current_assets: 4_700_000,
        non_current_assets: 900_000,
      })
    ).toBe(7_100_000);
  });

  it("returns null when any component is missing", () => {
    expect(
      computeTotalAssetsIfComplete({
        total_assets: null,
        fixed_assets: 1_500_000,
        other_assets: null,
        current_assets: 4_700_000,
        non_current_assets: 900_000,
      })
    ).toBeNull();
  });

  it("returns null when all components are missing", () => {
    expect(
      computeTotalAssetsIfComplete({
        total_assets: null,
        fixed_assets: null,
        other_assets: null,
        current_assets: null,
        non_current_assets: null,
      })
    ).toBeNull();
  });

  it("uses reported total when set even if components are missing", () => {
    expect(
      computeTotalAssetsIfComplete({
        total_assets: 999,
        fixed_assets: null,
        other_assets: null,
        current_assets: null,
        non_current_assets: null,
      })
    ).toBe(999);
  });
});

describe("computeTotalLiabilitiesIfComplete", () => {
  it("sums when all components are present including legitimate zeros", () => {
    expect(
      computeTotalLiabilitiesIfComplete({
        total_liabilities: null,
        current_liabilities: 2_900_000,
        long_term_liabilities: 0,
        non_current_liabilities: 200_000,
      })
    ).toBe(3_100_000);
  });

  it("returns null when any component is missing", () => {
    expect(
      computeTotalLiabilitiesIfComplete({
        total_liabilities: null,
        current_liabilities: 2_900_000,
        long_term_liabilities: null,
        non_current_liabilities: 200_000,
      })
    ).toBeNull();
  });

  it("keeps zero-default helper for Admin callers", () => {
    expect(
      computeTotalLiabilities({
        total_liabilities: null,
        current_liabilities: 2_900_000,
        long_term_liabilities: null,
        non_current_liabilities: null,
      })
    ).toBe(2_900_000);
  });
});

describe("computeNetWorth", () => {
  it("is total assets minus total liabilities", () => {
    expect(computeNetWorth(100, 40)).toBe(60);
    expect(computeNetWorth(100, 100)).toBe(0);
  });
});
