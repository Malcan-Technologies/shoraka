import {
  computeNetWorth,
  computeTurnoverGrowth,
  computeProfitMargin,
  computeTotalAssets,
  computeTotalLiabilities,
  resolveApplicationFinancialCurrentRatio,
  resolveApplicationFinancialProfitMarginRatio,
  resolveApplicationFinancialReturnOnEquityRatio,
  resolveApplicationFinancialTotalAssets,
  resolveApplicationFinancialTotalLiabilities,
  resolveFinancialSummaryCtosReturnOnEquityPercent,
  resolveFinancialSummaryIssuerReturnOnEquityRatio,
  resolveFinancialSummaryProfitMarginRatio,
  computeColumnMetrics,
  financialFormToBsPl,
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

describe("resolveFinancialSummaryProfitMarginRatio", () => {
  it("uses plnpat/turnover (15%)", () => {
    expect(
      resolveFinancialSummaryProfitMarginRatio({ plnpat: 15, turnover: 100 })
    ).toBeCloseTo(0.15);
  });

  it("ignores PBT and never uses CTOS profit_margin semantics", () => {
    // Even if a caller had PBT 20 vs PAT 15, this helper only sees plnpat.
    expect(
      resolveFinancialSummaryProfitMarginRatio({ plnpat: 15, turnover: 100 })
    ).toBeCloseTo(0.15);
    expect(
      resolveFinancialSummaryProfitMarginRatio({ plnpat: 15, turnover: 100 })
    ).not.toBeCloseTo(0.2);
  });

  it("returns null for zero or missing turnover", () => {
    expect(resolveFinancialSummaryProfitMarginRatio({ plnpat: 15, turnover: 0 })).toBeNull();
    expect(resolveFinancialSummaryProfitMarginRatio({ plnpat: 15, turnover: null })).toBeNull();
  });

  it("returns 0 when PAT is zero and turnover is valid", () => {
    expect(resolveFinancialSummaryProfitMarginRatio({ plnpat: 0, turnover: 100 })).toBe(0);
  });

  it("preserves negative PAT", () => {
    expect(
      resolveFinancialSummaryProfitMarginRatio({ plnpat: -25, turnover: 100 })
    ).toBeCloseTo(-0.25);
  });
});

describe("resolveFinancialSummaryIssuerReturnOnEquityRatio", () => {
  it("uses PAT / Net Worth (20%)", () => {
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: 100, netWorth: 500 })
    ).toBeCloseTo(0.2);
  });

  it("does not use Paid-Up Capital as denominator", () => {
    // Paid-up 200 would wrongly yield 50%; Net Worth 500 yields 20%.
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: 100, netWorth: 500 })
    ).toBeCloseTo(0.2);
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: 100, netWorth: 500 })
    ).not.toBeCloseTo(0.5);
  });

  it("returns null for zero or missing Net Worth", () => {
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: 100, netWorth: 0 })
    ).toBeNull();
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: 100, netWorth: null })
    ).toBeNull();
  });

  it("returns 0 when PAT is zero and Net Worth is valid", () => {
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: 0, netWorth: 500 })
    ).toBe(0);
  });

  it("preserves negative values", () => {
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: -50, netWorth: 200 })
    ).toBeCloseTo(-0.25);
    expect(
      resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: 50, netWorth: -200 })
    ).toBeCloseTo(-0.25);
  });
});

describe("resolveFinancialSummaryCtosReturnOnEquityPercent", () => {
  it("prefers flat CTOS return_on_equity as percent points (20%)", () => {
    expect(
      resolveFinancialSummaryCtosReturnOnEquityPercent({
        return_on_equity: 20,
        plnpat: 100,
        networth: 500,
        computedNetWorth: 500,
      })
    ).toBe(20);
  });

  it("falls back to PAT / Net Worth when flat ROE missing (20%)", () => {
    expect(
      resolveFinancialSummaryCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 100,
        networth: 500,
        computedNetWorth: null,
      })
    ).toBeCloseTo(20);
  });

  it("ignores Paid-Up Capital and uses Net Worth (20%, not 50%)", () => {
    expect(
      resolveFinancialSummaryCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 100,
        networth: 500,
        computedNetWorth: 200,
      })
    ).toBeCloseTo(20);
    expect(
      resolveFinancialSummaryCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 100,
        networth: 500,
        computedNetWorth: 200,
      })
    ).not.toBeCloseTo(50);
  });

  it("uses computed Net Worth when CTOS networth is missing", () => {
    expect(
      resolveFinancialSummaryCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 100,
        networth: null,
        computedNetWorth: 500,
      })
    ).toBeCloseTo(20);
  });

  it("returns null when Net Worth is zero", () => {
    expect(
      resolveFinancialSummaryCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 100,
        networth: 0,
        computedNetWorth: 500,
      })
    ).toBeNull();
  });

  it("returns 0 when PAT is zero and Net Worth is valid", () => {
    expect(
      resolveFinancialSummaryCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 0,
        networth: 500,
        computedNetWorth: null,
      })
    ).toBe(0);
  });

  it("preserves negative arithmetic", () => {
    expect(
      resolveFinancialSummaryCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: -50,
        networth: 200,
        computedNetWorth: null,
      })
    ).toBeCloseTo(-25);
    expect(
      resolveFinancialSummaryCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 50,
        networth: -200,
        computedNetWorth: null,
      })
    ).toBeCloseTo(-25);
  });
});

describe("financialFormToBsPl + computeColumnMetrics ROE", () => {
  it("maps equity from networth, never bsqpuc", () => {
    const { bs } = financialFormToBsPl({
      plnpat: 100,
      turnover: 1000,
      bsqpuc: 200,
      networth: 500,
      bscatot: 100,
      curlib: 50,
    });
    expect(bs.equity).toBe(500);
  });

  it("uses PAT ÷ Net Worth for return_of_equity (20%, not 50% via Paid-Up)", () => {
    const { bs, pl } = financialFormToBsPl({
      plnpat: 100,
      turnover: 1000,
      bsqpuc: 200,
      networth: 500,
      totass: 700,
      totlib: 200,
      bscatot: 100,
      curlib: 50,
    });
    const metrics = computeColumnMetrics(bs, pl, null);
    expect(metrics.return_of_equity).toBeCloseTo(0.2);
    expect(metrics.return_of_equity).not.toBeCloseTo(0.5);
  });

  it("falls back to totass − totlib when networth missing", () => {
    const { bs, pl } = financialFormToBsPl({
      plnpat: 100,
      turnover: 1000,
      bsqpuc: 200,
      totass: 700,
      totlib: 200,
      bscatot: 100,
      curlib: 50,
    });
    expect(bs.equity).toBeNull();
    const metrics = computeColumnMetrics(bs, pl, null);
    expect(metrics.networth).toBe(500);
    expect(metrics.return_of_equity).toBeCloseTo(0.2);
  });

  it("returns null ROE when Net Worth is zero", () => {
    const { bs, pl } = financialFormToBsPl({
      plnpat: 100,
      turnover: 1000,
      networth: 0,
      bscatot: 100,
      curlib: 50,
    });
    expect(computeColumnMetrics(bs, pl, null).return_of_equity).toBeNull();
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

  it("zero-defaults missing components for Application compatibility", () => {
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

describe("resolveApplicationFinancialTotalAssets", () => {
  it("prefers flat totass when present", () => {
    expect(
      resolveApplicationFinancialTotalAssets({
        totass: 10_000_000,
        bsfatot: 1,
        othass: 1,
        bscatot: 1,
        bsclbank: 1,
      })
    ).toBe(10_000_000);
  });

  it("falls back to component sum with zero-default", () => {
    expect(
      resolveApplicationFinancialTotalAssets({
        totass: null,
        bsfatot: 1_500_000,
        othass: null,
        bscatot: 4_700_000,
        bsclbank: null,
      })
    ).toBe(6_200_000);
  });

  it("returns 0 when all components and flat total are missing", () => {
    expect(
      resolveApplicationFinancialTotalAssets({
        totass: null,
        bsfatot: null,
        othass: null,
        bscatot: null,
        bsclbank: null,
      })
    ).toBe(0);
  });

  it("keeps legitimate zero components", () => {
    expect(
      resolveApplicationFinancialTotalAssets({
        totass: null,
        bsfatot: 1_500_000,
        othass: 0,
        bscatot: 4_000_000,
        bsclbank: 900_000,
      })
    ).toBe(6_400_000);
  });
});

describe("resolveApplicationFinancialTotalLiabilities", () => {
  it("prefers flat totlib when present", () => {
    expect(
      resolveApplicationFinancialTotalLiabilities({
        totlib: 9_000_000,
        curlib: 1,
        bsslltd: 1,
        bsclstd: 1,
      })
    ).toBe(9_000_000);
  });

  it("falls back to component sum with zero-default", () => {
    expect(
      resolveApplicationFinancialTotalLiabilities({
        totlib: null,
        curlib: 2_900_000,
        bsslltd: null,
        bsclstd: null,
      })
    ).toBe(2_900_000);
  });

  it("matches computeTotalLiabilities zero-default helper", () => {
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

describe("resolveApplicationFinancialProfitMarginRatio", () => {
  it("uses PAT / Turnover (15%)", () => {
    expect(
      resolveApplicationFinancialProfitMarginRatio({
        plnpat: 15,
        turnover: 100,
      })
    ).toBeCloseTo(0.15);
  });

  it("ignores CTOS profit_margin (PBT Margin) and still uses PAT / Turnover", () => {
    expect(
      resolveApplicationFinancialProfitMarginRatio({
        profit_margin: 20,
        plnpat: 15,
        turnover: 100,
      })
    ).toBeCloseTo(0.15);
  });

  it("returns null for zero or missing turnover", () => {
    expect(
      resolveApplicationFinancialProfitMarginRatio({ plnpat: 15, turnover: 0 })
    ).toBeNull();
    expect(
      resolveApplicationFinancialProfitMarginRatio({ plnpat: 15, turnover: null })
    ).toBeNull();
  });

  it("returns 0 when PAT is zero and turnover is valid", () => {
    expect(
      resolveApplicationFinancialProfitMarginRatio({ plnpat: 0, turnover: 100 })
    ).toBe(0);
  });

  it("preserves negative PAT", () => {
    expect(
      resolveApplicationFinancialProfitMarginRatio({ plnpat: -25, turnover: 100 })
    ).toBeCloseTo(-0.25);
  });
});

describe("resolveApplicationFinancialReturnOnEquityRatio", () => {
  it("uses PAT / Net Worth (20%) when flat ROE absent", () => {
    expect(
      resolveApplicationFinancialReturnOnEquityRatio({
        return_on_equity: null,
        plnpat: 100,
        networth: 500,
      })
    ).toBeCloseTo(0.2);
  });

  it("does not use Paid-Up Capital as denominator", () => {
    expect(
      resolveApplicationFinancialReturnOnEquityRatio({
        return_on_equity: null,
        plnpat: 100,
        networth: 500,
      })
    ).toBeCloseTo(0.2);
    expect(
      resolveApplicationFinancialReturnOnEquityRatio({
        return_on_equity: null,
        plnpat: 100,
        networth: 500,
      })
    ).not.toBeCloseTo(0.5);
  });

  it("prefers CTOS flat return_on_equity when present", () => {
    expect(
      resolveApplicationFinancialReturnOnEquityRatio({
        return_on_equity: 8.5,
        plnpat: 1,
        networth: 100,
      })
    ).toBeCloseTo(0.085);
  });

  it("returns null for zero or missing Net Worth", () => {
    expect(
      resolveApplicationFinancialReturnOnEquityRatio({
        return_on_equity: null,
        plnpat: 100,
        networth: 0,
      })
    ).toBeNull();
    expect(
      resolveApplicationFinancialReturnOnEquityRatio({
        return_on_equity: null,
        plnpat: 100,
        networth: null,
      })
    ).toBeNull();
  });

  it("returns 0 when PAT is zero and Net Worth is valid", () => {
    expect(
      resolveApplicationFinancialReturnOnEquityRatio({
        return_on_equity: null,
        plnpat: 0,
        networth: 500,
      })
    ).toBe(0);
  });

  it("preserves negative values", () => {
    expect(
      resolveApplicationFinancialReturnOnEquityRatio({
        return_on_equity: null,
        plnpat: -50,
        networth: 200,
      })
    ).toBeCloseTo(-0.25);
  });
});

describe("resolveApplicationFinancialCurrentRatio", () => {
  it("prefers CTOS flat currat when present", () => {
    expect(
      resolveApplicationFinancialCurrentRatio({
        currat: 1.32,
        bscatot: 1,
        curlib: 1,
      })
    ).toBe(1.32);
  });

  it("recomputes with missing→0 when flat absent", () => {
    expect(
      resolveApplicationFinancialCurrentRatio({
        currat: null,
        bscatot: 200,
        curlib: 100,
      })
    ).toBe(2);
    expect(
      resolveApplicationFinancialCurrentRatio({
        currat: null,
        bscatot: 100,
        curlib: 0,
      })
    ).toBeNull();
  });
});
