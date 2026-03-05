/**
 * Shared financial calculator utility.
 * Single source of truth for financial metric formulas used by backend and frontend.
 */

export interface FinancialStatementsInput {
  fixed_assets?: number;
  other_assets?: number;
  current_assets?: number;
  non_current_assets?: number;
  current_liability?: number;
  long_term_liability?: number;
  non_current_liability?: number;
  paid_up?: number;
  turnover?: number;
  profit_after_tax?: number;
}

export interface FinancialStatementsComputed {
  total_assets: number;
  total_liability: number;
  profit_margin: number | null;
  return_of_equity: number | null;
  current_ratio: number | null;
  working_capital: number;
  turnover_growth: null;
}

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function safeNum(input: FinancialStatementsInput, key: keyof FinancialStatementsInput): number {
  return toNum(input[key]);
}

/**
 * Returns computed financial metrics from input values.
 * Divide-by-zero safe; missing values default to 0.
 */
export function calculateFinancialMetrics(input: FinancialStatementsInput): FinancialStatementsComputed {
  const fa = safeNum(input, "fixed_assets");
  const oa = safeNum(input, "other_assets");
  const ca = safeNum(input, "current_assets");
  const nca = safeNum(input, "non_current_assets");
  const cl = safeNum(input, "current_liability");
  const ltl = safeNum(input, "long_term_liability");
  const ncl = safeNum(input, "non_current_liability");
  const paidUp = safeNum(input, "paid_up");
  const turnover = safeNum(input, "turnover");
  const pat = safeNum(input, "profit_after_tax");

  return {
    total_assets: fa + oa + ca + nca,
    total_liability: cl + ltl + ncl,
    turnover_growth: null,
    profit_margin: turnover !== 0 ? pat / turnover : null,
    return_of_equity: paidUp !== 0 ? pat / paidUp : null,
    current_ratio: cl !== 0 ? ca / cl : null,
    working_capital: ca - cl,
  };
}
