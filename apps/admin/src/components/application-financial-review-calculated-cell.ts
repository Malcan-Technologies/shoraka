/**
 * SECTION: Admin Financial Review calculated cells
 * WHY: Every calculated row shows the shared Financial Review result (`resolveFinancialReviewResult`),
 * the same values Financial approval stores and the Prospectus displays. No arithmetic here.
 */

import { formatCurrency, formatNumber } from "@cashsouk/config";
import type {
  FinancialReviewCalculatedKey,
  FinancialReviewCalculatedValues,
  FinancialReviewResolvedYear,
  FinancialReviewResult,
  FinancialReviewYearKind,
} from "@cashsouk/types";

export const CANNOT_CALCULATE_LABEL = "Cannot calculate";

type CalculatedCellFormat = "currency" | "percent" | "ratio" | "multiple";

/** Review row id → calculated key and display format (unchanged from the pre-shared-result screen). */
const CALCULATED_ROWS: Record<string, { key: FinancialReviewCalculatedKey; format: CalculatedCellFormat }> = {
  totass: { key: "totass", format: "currency" },
  totlib: { key: "totlib", format: "currency" },
  networth: { key: "networth", format: "currency" },
  ebit: { key: "ebit", format: "currency" },
  workcap: { key: "workcap", format: "currency" },
  turnover_growth: { key: "turnover_growth", format: "percent" },
  profit_margin: { key: "profit_margin", format: "percent" },
  roa: { key: "roa", format: "percent" },
  return_of_equity: { key: "return_on_equity", format: "percent" },
  currat: { key: "currat", format: "ratio" },
  quickRatio: { key: "quickRatio", format: "ratio" },
  receivablesDays: { key: "receivablesDays", format: "ratio" },
  payablesDays: { key: "payablesDays", format: "ratio" },
  assetTurnover: { key: "assetTurnover", format: "multiple" },
  gear: { key: "gear", format: "multiple" },
  debtEquityPercent: { key: "gear", format: "multiple" },
  netDebtEquity: { key: "netDebtEquity", format: "multiple" },
  interestCoverage: { key: "interestCoverage", format: "multiple" },
  dscr: { key: "dscr", format: "multiple" },
};

export function isFinancialReviewCalculatedRow(rowId: string): boolean {
  return Object.prototype.hasOwnProperty.call(CALCULATED_ROWS, rowId);
}

/** Result year with the same (year, kind) as the review column; null when the result has none. */
export function findFinancialReviewResultYear(
  result: FinancialReviewResult,
  year: number,
  kind: FinancialReviewYearKind
): FinancialReviewResolvedYear | null {
  return result.years.find((item) => item.year === year && item.kind === kind) ?? null;
}

/** Stored value of a calculated row; null when the row is not calculated or cannot calculate. */
function financialReviewCalculatedValue(
  rowId: string,
  values: FinancialReviewCalculatedValues | null | undefined
): number | null {
  const row = CALCULATED_ROWS[rowId];
  if (!row || !values) return null;
  return values[row.key] ?? null;
}

/**
 * Cell text for a calculated row. Percent metrics are already percent points (never × 100).
 * Missing value → Cannot calculate.
 */
export function formatFinancialReviewCalculatedCell(
  rowId: string,
  values: FinancialReviewCalculatedValues | null | undefined
): string {
  const row = CALCULATED_ROWS[rowId];
  const value = financialReviewCalculatedValue(rowId, values);
  if (!row || value == null) return CANNOT_CALCULATE_LABEL;
  switch (row.format) {
    case "currency":
      return formatCurrency(value, { decimals: 0 });
    case "percent":
      return formatNumber(value, 2) + "%";
    case "ratio":
      return formatNumber(value, 2);
    case "multiple":
      return `${formatNumber(value, 2)}x`;
  }
}

/** Year-selection reference date: the application's submission date, else today. */
export function resolveFinancialReviewReferenceDate(
  applicationSubmittedAt: string | null | undefined,
  now: Date = new Date()
): Date {
  if (!applicationSubmittedAt) return now;
  const submittedAt = new Date(applicationSubmittedAt);
  return Number.isNaN(submittedAt.getTime()) ? now : submittedAt;
}
