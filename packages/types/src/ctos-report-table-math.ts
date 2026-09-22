/**
 * SECTION: Issuer Application financial table calculations
 * WHY: One place for issuer-entered (unaudited) column metrics; not CTOS official formulas
 * INPUT: Plain numbers from a single issuer year column
 * OUTPUT: Metrics or null when not calculable (UI shows em dash / N/A)
 * WHERE USED: Admin Application Financial Summary / comparison for issuer columns only
 *
 * CTOS columns must use `ctos-financial-highlights.ts` (direct field or ENQWS v5.11.0 XSL only).
 * Do not add CTOS fallbacks here.
 */

import type { FinancialStatementsInput } from "./financial-calculator";

export type TotalAssetsInput = {
  total_assets: number | null;
  fixed_assets: number | null;
  other_assets: number | null;
  current_assets: number | null;
  non_current_assets: number | null;
};

export type TotalLiabilitiesInput = {
  total_liabilities: number | null;
  current_liabilities: number | null;
  long_term_liabilities: number | null;
  non_current_liabilities: number | null;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/**
 * Issuer Total assets: use reported total if present; otherwise sum the four asset lines.
 * Missing components default to 0. Not for CTOS columns.
 */
export function computeTotalAssets(input: TotalAssetsInput): number {
  if (isFiniteNumber(input.total_assets)) {
    return input.total_assets;
  }
  return (
    (input.fixed_assets ?? 0) +
    (input.other_assets ?? 0) +
    (input.current_assets ?? 0) +
    (input.non_current_assets ?? 0)
  );
}

/**
 * Issuer Total liabilities: use reported total if present; else sum liability lines.
 * Missing components default to 0. Not for CTOS columns.
 */
export function computeTotalLiabilities(input: TotalLiabilitiesInput): number {
  if (isFiniteNumber(input.total_liabilities)) {
    return input.total_liabilities;
  }
  return (
    (input.current_liabilities ?? 0) +
    (input.long_term_liabilities ?? 0) +
    (input.non_current_liabilities ?? 0)
  );
}

/**
 * Profit after tax ÷ turnover. Used for issuer Application Profit Margin (PAT).
 * Same identity as official CTOS PAT Margin XSL when expressed as a ratio.
 */
export function computeProfitMargin(pat: number | null, turnover: number | null): number | null {
  if (pat == null || turnover == null || !Number.isFinite(pat) || !Number.isFinite(turnover)) return null;
  if (turnover === 0) return null;
  return pat / turnover;
}

/**
 * Return on equity: profit after tax divided by equity denominator. Not if equity is zero or missing.
 */
export function computeReturnOnEquity(pat: number | null, equity: number | null): number | null {
  if (pat == null || equity == null || !Number.isFinite(pat) || !Number.isFinite(equity)) return null;
  if (equity === 0) return null;
  return pat / equity;
}

/**
 * Financial Summary issuer-submitted Return of Equity: PAT ÷ Net Worth as a decimal ratio.
 * Application input math — not a CTOS fallback.
 */
export function resolveFinancialSummaryIssuerReturnOnEquityRatio(input: {
  plnpat: number | null;
  netWorth: number | null;
}): number | null {
  return computeReturnOnEquity(input.plnpat, input.netWorth);
}

/**
 * Current ratio from issuer-entered current assets / current liabilities.
 */
export function computeCurrentRatio(currentAssets: number | null, currentLiabilities: number | null): number | null {
  if (currentAssets == null || currentLiabilities == null) return null;
  if (!Number.isFinite(currentAssets) || !Number.isFinite(currentLiabilities)) return null;
  if (currentLiabilities === 0) return null;
  return currentAssets / currentLiabilities;
}

/**
 * Working capital: current assets minus current liabilities (uses zero when a side is missing).
 */
export function computeWorkingCapital(currentAssets: number | null, currentLiabilities: number | null): number {
  return (currentAssets ?? 0) - (currentLiabilities ?? 0);
}

/**
 * Book net worth (net assets): total assets minus total liabilities.
 */
export function computeNetWorth(totalAssets: number, totalLiabilities: number): number {
  return totalAssets - totalLiabilities;
}

export interface TurnoverGrowthInput {
  targetYear: number;
  targetTurnover: number | null;
  priorYear: number;
  priorTurnover: number | null;
}

/**
 * Turnover growth: (this year − last year) ÷ last year.
 * Only when prior year is exactly one calendar year before target (no skipped years).
 * Not calculable if either turnover is missing, or prior turnover is zero.
 */
export function computeTurnoverGrowth(i: TurnoverGrowthInput): number | null {
  if (i.priorYear !== i.targetYear - 1) return null;
  if (i.targetTurnover == null || i.priorTurnover == null) return null;
  if (!Number.isFinite(i.targetTurnover) || !Number.isFinite(i.priorTurnover)) return null;
  if (i.priorTurnover === 0) return null;
  return (i.targetTurnover - i.priorTurnover) / i.priorTurnover;
}

export interface ColumnComputedMetrics {
  totass: number;
  totlib: number;
  networth: number;
  profit_margin: number | null;
  return_of_equity: number | null;
  currat: number | null;
  workcap: number;
  turnover_growth: number | null;
}

/**
 * Ratios for one issuer year column from balance sheet + P&amp;L numbers.
 * Not for CTOS columns — those use `ctos-financial-highlights.ts`.
 */
export function computeColumnMetrics(
  bs: {
    fixed_assets: number | null;
    other_assets: number | null;
    current_assets: number | null;
    non_current_assets: number | null;
    total_assets: number | null;
    current_liabilities: number | null;
    long_term_liabilities: number | null;
    non_current_liabilities: number | null;
    total_liabilities: number | null;
    equity: number | null;
  },
  pl: { profit_after_tax: number | null; revenue: number | null },
  turnoverGrowth: number | null
): ColumnComputedMetrics {
  const totass = computeTotalAssets(bs);
  const totlib = computeTotalLiabilities(bs);
  const networth = computeNetWorth(totass, totlib);
  // ROE denominator: prefer explicit Net Worth on `equity`; else totass − totlib. Never Paid-Up Capital.
  const roeEquity =
    bs.equity != null && Number.isFinite(bs.equity) ? bs.equity : networth;
  return {
    totass,
    totlib,
    networth,
    profit_margin: computeProfitMargin(pl.profit_after_tax, pl.revenue),
    return_of_equity: computeReturnOnEquity(pl.profit_after_tax, roeEquity),
    currat: computeCurrentRatio(bs.current_assets, bs.current_liabilities),
    workcap: computeWorkingCapital(bs.current_assets, bs.current_liabilities),
    turnover_growth: turnoverGrowth,
  };
}

/**
 * Maps flat financial statement fields (issuer step) into balance sheet / P&amp;L slices for metrics.
 * `equity` is Net Worth only (flat `networth`). Never map Paid-Up Capital (`bsqpuc`) here.
 */
export function financialFormToBsPl(fs: FinancialStatementsInput) {
  const n = (v: number | undefined) => (v == null || Number.isNaN(v) ? null : v);
  return {
    bs: {
      fixed_assets: n(fs.bsfatot),
      other_assets: n(fs.othass),
      current_assets: n(fs.bscatot),
      non_current_assets: n(fs.bsclbank),
      total_assets: n(fs.totass),
      current_liabilities: n(fs.curlib),
      long_term_liabilities: n(fs.bsslltd),
      non_current_liabilities: n(fs.bsclstd),
      total_liabilities: n(fs.totlib),
      equity: n(fs.networth),
    },
    pl: {
      profit_after_tax: n(fs.plnpat),
      revenue: n(fs.turnover),
    },
  };
}

/**
 * EBIT = Profit Before Tax + Interest Cost
 * Returns null when either input is missing or interest cost is not calculable.
 */
export function computeEbit(plnpbt: number | null | undefined, interest_cost: number | null | undefined): number | null {
  if (!isFiniteNumber(plnpbt) || !isFiniteNumber(interest_cost)) return null;
  return plnpbt + interest_cost;
}

/**
 * Quick Ratio = (Cash & Bank + Trade Receivables) / Current Liabilities
 * Missing inputs never default to 0.
 */
export function computeQuickRatio(
  cashAndBank: number | null | undefined,
  tradeReceivables: number | null | undefined,
  curlib: number | null | undefined
): number | null {
  if (!isFiniteNumber(cashAndBank) || !isFiniteNumber(tradeReceivables) || !isFiniteNumber(curlib)) return null;
  if (curlib === 0) return null;
  return (cashAndBank + tradeReceivables) / curlib;
}

/**
 * Interest Coverage = EBIT / Interest Cost
 * Returns null when interest cost is missing or zero.
 */
export function computeInterestCoverage(
  ebit: number | null | undefined,
  interest_cost: number | null | undefined
): number | null {
  if (!isFiniteNumber(ebit) || !isFiniteNumber(interest_cost)) return null;
  if (interest_cost === 0) return null;
  return ebit / interest_cost;
}

/**
 * Receivables Days = Average Accounts Receivable / Revenue × 365
 * Average AR = (Beginning AR + Ending AR) / 2
 *
 * Returns null when either beginning/ending AR is missing or when turnover is missing/zero.
 */
export function computeReceivablesDays(
  beginningAr: number | null | undefined,
  endingAr: number | null | undefined,
  turnover: number | null | undefined
): number | null {
  if (!isFiniteNumber(beginningAr) || !isFiniteNumber(endingAr) || !isFiniteNumber(turnover)) return null;
  if (turnover === 0) return null;
  const averageAr = (beginningAr + endingAr) / 2;
  return (averageAr / turnover) * 365;
}

/**
 * Payables Days = Trade Payables / Cost of Sales × 365
 * Returns null when costOfSales is missing or zero.
 */
export function computePayablesDays(
  tradePayables: number | null | undefined,
  costOfSales: number | null | undefined
): number | null {
  if (!isFiniteNumber(tradePayables) || !isFiniteNumber(costOfSales)) return null;
  if (costOfSales === 0) return null;
  return (tradePayables / costOfSales) * 365;
}

/**
 * Net Debt / Equity =
 *   (Current Borrowings + Non-current Loans - Cash & Bank) / Total Equity
 *
 * Uses `networth` (Total Equity) denominator.
 */
export function computeNetDebtEquity(params: {
  curlib_borrowing: number | null | undefined;
  ncl_loan: number | null | undefined;
  cashAndBank: number | null | undefined;
  networth: number | null | undefined;
}): number | null {
  const { curlib_borrowing, ncl_loan, cashAndBank, networth } = params;
  if (!isFiniteNumber(curlib_borrowing) || !isFiniteNumber(ncl_loan) || !isFiniteNumber(cashAndBank) || !isFiniteNumber(networth)) {
    return null;
  }
  if (networth === 0) return null;
  return (curlib_borrowing + ncl_loan - cashAndBank) / networth;
}

/**
 * DSCR = Net Operating Income / Annual Debt Service
 * Returns null when netOperatingIncome is missing or when annualDebtService is missing/zero.
 */
export function computeDscr(
  netOperatingIncome: number | null | undefined,
  annualDebtService: number | null | undefined
): number | null {
  if (!isFiniteNumber(netOperatingIncome) || !isFiniteNumber(annualDebtService)) return null;
  if (annualDebtService === 0) return null;
  return netOperatingIncome / annualDebtService;
}
