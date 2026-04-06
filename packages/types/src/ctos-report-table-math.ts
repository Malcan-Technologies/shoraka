/**
 * SECTION: Admin CTOS financial table calculations
 * WHY: One place for ratio rules; tests prevent formula drift
 * INPUT: Plain numbers from a single year column
 * OUTPUT: Metrics or null when not calculable (UI shows em dash)
 * WHERE USED: Admin financial / CTOS review table only
 */

import type { FinancialStatementsInput } from "./financial-calculator";

/**
 * Total assets: use reported total if present; otherwise sum the four asset lines.
 */
export function computeTotalAssets(input: {
  total_assets: number | null;
  fixed_assets: number | null;
  other_assets: number | null;
  current_assets: number | null;
  non_current_assets: number | null;
}): number {
  if (input.total_assets != null && Number.isFinite(input.total_assets)) {
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
 * Total liabilities: use reported total if present; else sum liability lines.
 */
export function computeTotalLiabilities(input: {
  total_liabilities: number | null;
  current_liabilities: number | null;
  long_term_liabilities: number | null;
  non_current_liabilities: number | null;
}): number {
  if (input.total_liabilities != null && Number.isFinite(input.total_liabilities)) {
    return input.total_liabilities;
  }
  return (
    (input.current_liabilities ?? 0) +
    (input.long_term_liabilities ?? 0) +
    (input.non_current_liabilities ?? 0)
  );
}

/**
 * Profit margin: profit after tax divided by turnover. Not calculable if turnover is zero or missing.
 */
export function computeProfitMargin(pat: number | null, turnover: number | null): number | null {
  if (pat == null || turnover == null || !Number.isFinite(pat) || !Number.isFinite(turnover)) return null;
  if (turnover === 0) return null;
  return pat / turnover;
}

/**
 * Return on equity: profit after tax divided by equity (paid-up capital). Not if equity is zero or missing.
 */
export function computeReturnOnEquity(pat: number | null, equity: number | null): number | null {
  if (pat == null || equity == null || !Number.isFinite(pat) || !Number.isFinite(equity)) return null;
  if (equity === 0) return null;
  return pat / equity;
}

/**
 * Current ratio: current assets divided by current liabilities. Not if current liabilities are zero or missing.
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
 * Book net worth (net assets): total assets minus total liabilities. Matches totass and totlib rules.
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
 * Ratios for one year column from balance sheet + P&amp;L numbers (issuer form or CTOS-derived).
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
  return {
    totass,
    totlib,
    networth,
    profit_margin: computeProfitMargin(pl.profit_after_tax, pl.revenue),
    return_of_equity: computeReturnOnEquity(pl.profit_after_tax, bs.equity),
    currat: computeCurrentRatio(bs.current_assets, bs.current_liabilities),
    workcap: computeWorkingCapital(bs.current_assets, bs.current_liabilities),
    turnover_growth: turnoverGrowth,
  };
}

/**
 * Maps flat financial statement fields (issuer step) into balance sheet / P&amp;L slices for metrics.
 */
export function financialFormToBsPl(fs: FinancialStatementsInput) {
  const n = (v: number | undefined) => (v == null || Number.isNaN(v) ? null : v);
  return {
    bs: {
      fixed_assets: n(fs.bsfatot),
      other_assets: n(fs.othass),
      current_assets: n(fs.bscatot),
      non_current_assets: n(fs.bsclbank),
      total_assets: null,
      current_liabilities: n(fs.curlib),
      long_term_liabilities: n(fs.bsslltd),
      non_current_liabilities: n(fs.bsclstd),
      total_liabilities: null,
      equity: n(fs.bsqpuc),
    },
    pl: {
      profit_after_tax: n(fs.plnpat),
      revenue: n(fs.turnover),
    },
  };
}
