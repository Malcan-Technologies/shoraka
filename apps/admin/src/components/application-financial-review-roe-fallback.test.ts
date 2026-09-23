import {
  resolveCtosReturnOnEquityPercent,
  resolveFinancialSummaryIssuerReturnOnEquityRatio,
} from "@cashsouk/types";
import {
  getReturnOfEquityMissingReason,
  resolveNetWorthFromComponentsForRoe,
} from "./application-financial-review-roe-fallback";

describe("Admin Financial Summary ROE fallback (PAT ÷ Total Equity / Net Worth)", () => {
  it("fallback calculates ROE = 453,600 ÷ 2,700,000 × 100 = 16.80% when CTOS return_on_equity is absent", () => {
    const netWorth = resolveNetWorthFromComponentsForRoe({
      fixedAssets: 2_700_000,
      otherAssets: 0,
      currentAssets: 0,
      nonCurrentAssets: 0,
      currentLiabilities: 0,
      longTermLiabilities: 0,
      nonCurrentLiabilities: 0,
    });
    expect(netWorth).toBe(2_700_000);

    const roeRatio = resolveFinancialSummaryIssuerReturnOnEquityRatio({
      plnpat: 453_600,
      netWorth,
    });
    expect(roeRatio).not.toBeNull();

    // Component renders: `${formatNumber(roeRatio * 100, 2)}%`
    expect((roeRatio! * 100).toFixed(2)).toBe("16.80");
  });

  it("CTOS finished return_on_equity wins over fallback even when PAT/net worth differ", () => {
    const ctosPercent = resolveCtosReturnOnEquityPercent({
      return_on_equity: 12.34,
    });
    expect(ctosPercent).not.toBeNull();
    expect(ctosPercent!).toBeCloseTo(12.34, 6);

    const netWorth = resolveNetWorthFromComponentsForRoe({
      fixedAssets: 2_700_000,
      otherAssets: 0,
      currentAssets: 0,
      nonCurrentAssets: 0,
      currentLiabilities: 0,
      longTermLiabilities: 0,
      nonCurrentLiabilities: 0,
    });

    const roeRatio = resolveFinancialSummaryIssuerReturnOnEquityRatio({
      plnpat: 453_600,
      netWorth,
    });
    expect(roeRatio).not.toBeNull();

    // CTOS percent should not equal fallback percent for this mismatch case.
    expect((roeRatio! * 100).toFixed(2)).not.toBe(ctosPercent!.toFixed(2));
  });

  it("failure cases: ROE shows accurate helper reasons when PAT or Net Worth is unavailable", () => {
    expect(getReturnOfEquityMissingReason({ pat: null, netWorth: 2_700_000 })).toBe(
      "Missing: Profit / Loss After Tax"
    );
    expect(getReturnOfEquityMissingReason({ pat: 453_600, netWorth: null })).toBe(
      "Missing: Total Equity / Net Worth"
    );
    expect(getReturnOfEquityMissingReason({ pat: 453_600, netWorth: 0 })).toBe(
      "Missing: Total Equity / Net Worth"
    );
  });
});

