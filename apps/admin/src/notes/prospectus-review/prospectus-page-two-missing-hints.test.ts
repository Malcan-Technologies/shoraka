import type { ProspectusFrozenFinancialRaw } from "@cashsouk/types";
import {
  getProspectusPageTwoCalculatedMissingHint,
  type ProspectusPageTwoCalculatedMetric,
} from "./prospectus-page-two-missing-hints";

const baseFrozenRaw: ProspectusFrozenFinancialRaw = {
  turnover: 1_000_000,
  plnpbt: 120_000,
  plnpat: 100_000,
  ebit: 180_000,
  grossProfit: 300_000,
  ebitda: 200_000,
  netOperatingIncome: 900_000,
  bscatot: 400_000,
  curlib: 150_000,
  bsfatot: 200_000,
  othass: 50_000,
  bsclbank: 25_000,
  cashAndBank: 10_000,
  costOfSales: 680_000,
  tradeReceivables: 15_000,
  receivablesDays: 74,
  tradePayables: 12_000,
  payablesDays: 48,
  bsslltd: 80_000,
  bsclstd: 20_000,
  bsqpuc: 500_000,
  quickRatio: 1.25,
  operatingCashFlow: 1_400_000,
  freeCashFlow: 1_100_000,
  annualDebtService: 1_000_000,
  networth: 500_000,
  totass: 1_000_000,
  totlib: 250_000,
  profit_margin: null,
  return_on_equity: null,
  currat: null,
  gear: null,
  netDebtEquity: null,
  interestCoverage: null,
  dscr: null,
};

function hint(metric: ProspectusPageTwoCalculatedMetric, frozenRaw: ProspectusFrozenFinancialRaw, prevTradeReceivables: number | null) {
  return getProspectusPageTwoCalculatedMissingHint({ metric, frozenRaw, prevTradeReceivables });
}

describe("Prospectus Page 2 enhancer missing hints (frozen model paths)", () => {
  it("Interest Coverage: Interest Costs missing -> Missing: Interest Costs", () => {
    const frozen: ProspectusFrozenFinancialRaw = { ...baseFrozenRaw, ebit: null };
    expect(hint("Interest Coverage (x)", frozen, 10_000)).toBe("Missing: Interest Costs");
  });

  it("Interest Coverage: frozen cannot prove exact cause -> Missing required financial inputs", () => {
    // ebit exists, but interest_cost is not present in frozen raw, so we must not invent.
    const frozen: ProspectusFrozenFinancialRaw = { ...baseFrozenRaw, ebit: 180_000 };
    expect(hint("Interest Coverage (x)", frozen, 10_000)).toBe("Missing required financial inputs");
  });

  it("DSCR: Annual Debt Service missing -> Missing: Annual Debt Service", () => {
    const frozen: ProspectusFrozenFinancialRaw = { ...baseFrozenRaw, annualDebtService: null };
    expect(hint("DSCR (x)", frozen, 10_000)).toBe("Missing: Annual Debt Service");
  });

  it("DSCR: Net Operating Income missing -> Missing: Net Operating Income", () => {
    const frozen: ProspectusFrozenFinancialRaw = { ...baseFrozenRaw, netOperatingIncome: null };
    expect(hint("DSCR (x)", frozen, 10_000)).toBe("Missing: Net Operating Income");
  });

  it("Net Debt / Equity: no granular borrowings in frozen raw -> does not invent a specific field", () => {
    const frozen: ProspectusFrozenFinancialRaw = { ...baseFrozenRaw, cashAndBank: 10_000, networth: 500_000 };
    expect(hint("Net Debt / Equity (x)", frozen, 10_000)).toBe(
      "Missing required financial inputs"
    );
  });

  it("ROE: Net Worth zero -> Invalid zero helper", () => {
    const frozen: ProspectusFrozenFinancialRaw = { ...baseFrozenRaw, networth: 0 };
    expect(hint("ROE (%)", frozen, 10_000)).toBe("Invalid: Total Equity / Net Worth is zero");
  });

  it("Current Ratio: Current Liabilities zero -> Invalid zero helper", () => {
    const frozen: ProspectusFrozenFinancialRaw = { ...baseFrozenRaw, curlib: 0 };
    expect(hint("Current Ratio (x)", frozen, 10_000)).toBe("Invalid: Current Liabilities is zero");
  });

  it("Receivables Days: previous FY Trade Receivables missing -> exact helper", () => {
    const frozen: ProspectusFrozenFinancialRaw = { ...baseFrozenRaw, tradeReceivables: 15_000 };
    expect(hint("Receivables Days", frozen, null)).toBe(
      "Missing: previous financial year Trade Receivables"
    );
  });

  it("Guard: no metric self-reference helper strings appear", () => {
    const forbidden = [
      "Missing: Return on Equity",
      "Missing: Current Ratio",
      "Missing: Net Debt / Equity",
      "Missing: DSCR",
      "Missing: Interest Coverage",
      "Missing: Asset Turnover",
      "Missing: Return on Assets",
      "Missing: Payables Days",
    ];

    const scenarios: Array<[ProspectusPageTwoCalculatedMetric, ProspectusFrozenFinancialRaw, number | null]> = [
      ["ROE (%)", { ...baseFrozenRaw, networth: 0 }, 10_000],
      ["Current Ratio (x)", { ...baseFrozenRaw, curlib: 0 }, 10_000],
      ["Net Debt / Equity (x)", baseFrozenRaw, 10_000],
      ["Interest Coverage (x)", { ...baseFrozenRaw, ebit: null }, 10_000],
      ["DSCR (x)", { ...baseFrozenRaw, annualDebtService: null }, 10_000],
      ["Receivables Days", baseFrozenRaw, null],
    ];

    for (const [metric, frozen, prevTradeReceivables] of scenarios) {
      const h = hint(metric, frozen, prevTradeReceivables);
      for (const f of forbidden) {
        expect(h).not.toBe(f);
        expect(h).not.toContain(f);
      }
    }
  });
});

