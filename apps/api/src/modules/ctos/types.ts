/**
 * SECTION: CTOS parsed and API shapes
 * WHY: Shared types for parser output and admin DTOs
 * INPUT: N/A (types only)
 * OUTPUT: TypeScript interfaces
 * WHERE USED: ctos module and admin responses
 */

export interface CtosFinancialBalanceSheet {
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
}

export interface CtosFinancialProfitAndLoss {
  revenue: number | null;
  profit_before_tax: number | null;
  profit_after_tax: number | null;
  net_dividend: number | null;
  /** Raw CTOS `plyear` field (currency line, not calendar year). */
  profit_line_amount: number | null;
}

export interface CtosFinancialYearRow {
  reporting_year: number | null;
  financial_year_end_date: string | null;
  balance_sheet_date: string | null;
  balance_sheet: CtosFinancialBalanceSheet;
  profit_and_loss: CtosFinancialProfitAndLoss;
}

export interface CtosReportParsed {
  raw_xml: string;
  summary_json: Record<string, unknown>;
  company_json: Record<string, unknown>;
  legal_json: Record<string, unknown>;
  ccris_json: Record<string, unknown>;
  financials_json: CtosFinancialYearRow[];
}
