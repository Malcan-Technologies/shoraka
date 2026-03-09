/**
 * Shared financial calculator utility.
 * Used by admin dashboards or analytics when financial ratios are needed.
 * Input uses canonical field keys; computed metrics are never stored.
 */

export interface FinancialStatementsInput {
  bsfatot?: number;
  othass?: number;
  bscatot?: number;
  bsclbank?: number;
  curlib?: number;
  bsslltd?: number;
  bsclstd?: number;
  bsqpuc?: number;
  turnover?: number;
  plnpat?: number;
}

export interface FinancialStatementsComputed {
  totass: number;
  totlib: number;
  profit_margin: number | null;
  return_of_equity: number | null;
  currat: number | null;
  workcap: number;
  turnover_growth: number | null;
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
  const bsfatot = safeNum(input, "bsfatot");
  const othass = safeNum(input, "othass");
  const bscatot = safeNum(input, "bscatot");
  const bsclbank = safeNum(input, "bsclbank");
  const curlib = safeNum(input, "curlib");
  const bsslltd = safeNum(input, "bsslltd");
  const bsclstd = safeNum(input, "bsclstd");
  const bsqpuc = safeNum(input, "bsqpuc");
  const turnover = safeNum(input, "turnover");
  const plnpat = safeNum(input, "plnpat");

  return {
    totass: bsfatot + othass + bscatot + bsclbank,
    totlib: curlib + bsslltd + bsclstd,
    turnover_growth: null,
    profit_margin: turnover !== 0 ? plnpat / turnover : null,
    return_of_equity: bsqpuc !== 0 ? plnpat / bsqpuc : null,
    currat: curlib !== 0 ? bscatot / curlib : null,
    workcap: bscatot - curlib,
  };
}
