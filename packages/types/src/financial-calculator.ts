/**
 * Shared financial statement input shape for issuer Application forms.
 * CTOS-derived display metrics use `ctos-financial-highlights.ts` instead.
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
