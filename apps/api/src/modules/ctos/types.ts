/**
 * SECTION: CTOS parsed and API shapes
 * WHY: Shared types for parser output and admin DTOs (matches ctos-test harness JSON)
 * INPUT: N/A (types only)
 * OUTPUT: TypeScript interfaces
 * WHERE USED: ctos module and admin responses
 */

/** Numeric `<account>` tags stored under each financial year row (same allowlist as parser). */
export const CTOS_ACCOUNT_NUMERIC_CODENAMES = [
  "bsfatot",
  "othass",
  "bscatot",
  "bsclbank",
  "totass",
  "curlib",
  "bsslltd",
  "bsclstd",
  "totlib",
  "bsqpuc",
  "turnover",
  "plnpbt",
  "plnpat",
  "plnetdiv",
  "plyear",
  "networth",
  "turnover_growth",
  "profit_margin",
  "return_on_equity",
  "currat",
  "workcap",
] as const;

export type CtosFinancialAccountJson = {
  [K in (typeof CTOS_ACCOUNT_NUMERIC_CODENAMES)[number]]: number | null;
};

export interface CtosFinancialYearRow {
  /** Calendar year from pldd minus one (display / admin column year). */
  financial_year: number | null;
  dates: { pldd: string | null; bsdd: string | null };
  account: CtosFinancialAccountJson;
}

export interface CtosPersonJson {
  name: string | null;
  nic_brno: string | null;
  ic_lcno: string | null;
  nationality: string | null;
  birth_date: string | null;
  addr: string | null;
}

export interface CtosReportParsed {
  raw_xml: string;
  summary_json: Record<string, unknown>;
  person_json: CtosPersonJson | null;
  company_json: Record<string, unknown> | null;
  legal_json: Record<string, unknown>;
  ccris_json: Record<string, unknown>;
  financials_json: CtosFinancialYearRow[];
}
