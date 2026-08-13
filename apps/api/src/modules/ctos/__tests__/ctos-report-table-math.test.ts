import {
  computeNetWorth,
  computeTurnoverGrowth,
  computeProfitMargin,
  computeTotalAssets,
  computeTotalLiabilities,
  computeCurrentRatio,
  resolveFinancialSummaryIssuerReturnOnEquityRatio,
  computeColumnMetrics,
  financialFormToBsPl,
  resolveCtosCurrentRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnEquityPercent,
  resolveCtosTotalAssets,
  resolveCtosTotalLiabilities,
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

describe("computeProfitMargin (issuer Application)", () => {
  it("returns null when turnover is zero", () => {
    expect(computeProfitMargin(100, 0)).toBeNull();
  });

  it("returns pat/turnover when valid", () => {
    expect(computeProfitMargin(50, 200)).toBeCloseTo(0.25);
  });
});

describe("resolveFinancialSummaryIssuerReturnOnEquityRatio", () => {
  it("uses PAT / Net Worth (20%)", () => {
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: 100, netWorth: 500 })
    ).toBeCloseTo(0.2);
  });

  it("returns null when net worth is zero", () => {
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: 100, netWorth: 0 })
    ).toBeNull();
  });
});

describe("financialFormToBsPl + computeColumnMetrics ROE (issuer only)", () => {
  it("uses flat networth when present", () => {
    const { bs, pl } = financialFormToBsPl({
      bsfatot: 10,
      othass: 0,
      bscatot: 20,
      bsclbank: 0,
      curlib: 5,
      bsslltd: 0,
      bsclstd: 0,
      bsqpuc: 999,
      networth: 500,
      totass: 1000,
      totlib: 200,
      turnover: 100,
      plnpat: 50,
    });
    const metrics = computeColumnMetrics(bs, pl, null);
    expect(metrics.return_of_equity).toBeCloseTo(0.1);
  });

  it("falls back to totass − totlib when networth missing", () => {
    const { bs, pl } = financialFormToBsPl({
      bsfatot: 100,
      othass: 0,
      bscatot: 0,
      bsclbank: 0,
      curlib: 40,
      bsslltd: 0,
      bsclstd: 0,
      turnover: 100,
      plnpat: 30,
    });
    const metrics = computeColumnMetrics(bs, pl, null);
    expect(metrics.networth).toBe(60);
    expect(metrics.return_of_equity).toBeCloseTo(0.5);
  });

  it("returns null ROE when equity denominator is zero", () => {
    const { bs, pl } = financialFormToBsPl({
      bsfatot: 50,
      othass: 0,
      bscatot: 0,
      bsclbank: 0,
      curlib: 50,
      bsslltd: 0,
      bsclstd: 0,
      turnover: 100,
      plnpat: 10,
    });
    expect(computeColumnMetrics(bs, pl, null).return_of_equity).toBeNull();
  });
});

describe("computeTotalAssets / computeTotalLiabilities (issuer only)", () => {
  it("prefers reported total when present", () => {
    expect(
      computeTotalAssets({
        total_assets: 999,
        fixed_assets: 1,
        other_assets: 1,
        current_assets: 1,
        non_current_assets: 1,
      })
    ).toBe(999);
  });

  it("sums components when total missing", () => {
    expect(
      computeTotalAssets({
        total_assets: null,
        fixed_assets: 10,
        other_assets: 20,
        current_assets: 30,
        non_current_assets: 40,
      })
    ).toBe(100);
    expect(
      computeTotalLiabilities({
        total_liabilities: null,
        current_liabilities: 10,
        long_term_liabilities: 20,
        non_current_liabilities: 5,
      })
    ).toBe(35);
  });
});

describe("computeNetWorth / computeCurrentRatio (issuer only)", () => {
  it("subtracts liabilities from assets", () => {
    expect(computeNetWorth(100, 40)).toBe(60);
    expect(computeNetWorth(100, 100)).toBe(0);
  });

  it("divides current assets by current liabilities", () => {
    expect(computeCurrentRatio(200, 100)).toBe(2);
    expect(computeCurrentRatio(200, 0)).toBeNull();
  });
});

describe("Application Financial Summary CTOS columns (official only)", () => {
  it("ROE: direct exists → exact; missing with PAT/networth → still null", () => {
    expect(resolveCtosReturnOnEquityPercent({ return_on_equity: 12.5 })).toBe(12.5);
    expect(
      resolveCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 100,
        networth: 500,
      })
    ).toBeNull();
  });

  it("Current Ratio: direct exists → exact; missing with CA/CL → still null", () => {
    expect(resolveCtosCurrentRatio({ currat: 1.4 })).toBe(1.4);
    expect(resolveCtosCurrentRatio({ currat: null, bscatot: 400, curlib: 200 })).toBeNull();
  });

  it("Total Assets / Liabilities: direct only; no component reconstruction", () => {
    expect(resolveCtosTotalAssets({ totass: 900 })).toBe(900);
    expect(resolveCtosTotalAssets({ totass: null })).toBeNull();
    expect(resolveCtosTotalLiabilities({ totlib: 300 })).toBe(300);
    expect(resolveCtosTotalLiabilities({ totlib: null })).toBeNull();
  });

  it("Profit Margin row: official PAT XSL; never CTOS profit_margin (PBT)", () => {
    expect(
      resolveCtosPatMarginPercent({ plnpat: 15, turnover: 100, profit_margin: 99 })
    ).toBe(15);
    expect(resolveCtosPatMarginPercent({ plnpat: 15, turnover: 0 })).toBeNull();
  });
});
