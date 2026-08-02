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
  /** Flat Net Worth when present — never use Paid-Up Capital as equity. */
  networth?: number;
  /** Flat Total Assets when present. */
  totass?: number;
  /** Flat Total Liabilities when present. */
  totlib?: number;
  turnover?: number;
  plnpat?: number;
}

/**
 * Returns profit margin (plnpat / turnover). Divide-by-zero safe.
 */
export function calculateProfitMargin(plnpat: number, turnover: number): number | null {
  if (turnover === 0) return null;
  return plnpat / turnover;
}

/**
 * Returns current ratio (bscatot / curlib). Divide-by-zero safe.
 */
export function calculateCurrentRatio(bscatot: number, curlib: number): number | null {
  if (curlib === 0) return null;
  return bscatot / curlib;
}
