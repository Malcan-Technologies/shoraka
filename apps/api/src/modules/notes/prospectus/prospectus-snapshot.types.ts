/**
 * SECTION: Frozen prospectus Page 1 snapshot (Stages 7–8)
 * WHY: Published prospectuses must not drift with live statuses/payments/window
 */

export type ProspectusHistoricalNoteStatus = "ACTIVE" | "REPAID" | "ARREARS" | "DEFAULTED";

export interface ProspectusPage1IssuerTrackRecordSnapshot {
  total_notes_funded: number | null;
  /** Raw decimal string — format at render. */
  total_amount_funded: string | null;
  successful_repayment_percent: number | null;
  on_time_payment_rate_six_months_percent: number | null;
  calculated_at: string;
}

export interface ProspectusPage1HistoricalNoteSnapshot {
  note_id: string;
  note_reference: string | null;
  financing_type: string | null;
  funded_amount: string | null;
  listing_opens_at: string | null;
  maturity_date: string | null;
  profit_rate_percent: string | number | null;
  status: ProspectusHistoricalNoteStatus;
  repaid_at: string | null;
  updated_at: string;
}

export interface ProspectusPage1Snapshot {
  issuer_track_record: ProspectusPage1IssuerTrackRecordSnapshot;
  historical_notes: ProspectusPage1HistoricalNoteSnapshot[];
}

/** Raw Application unaudited fields needed by Stage 4B — not formatted display strings. */
export interface ProspectusPage2FinancialRawSnapshot {
  turnover: string | number | null;
  plnpat: string | number | null;
  bsqpuc: string | number | null;
  bscatot: string | number | null;
  curlib: string | number | null;
}

export interface ProspectusPage2FinancialYearSnapshot {
  year: number;
  year_label: string;
  financial_year_end_label: string | null;
  raw_financials: ProspectusPage2FinancialRawSnapshot;
}

export interface ProspectusPage2FinancialComparisonSnapshot {
  source: "application_financial_statements";
  selected_years: ProspectusPage2FinancialYearSnapshot[];
  calculated_at: string;
}

export interface ProspectusPage2ConfigVersionsSnapshot {
  soukscore_scale: string | null;
  legal_copy: string | null;
  marketing_copy: string | null;
}

export interface ProspectusPage2Snapshot {
  financial_comparison: ProspectusPage2FinancialComparisonSnapshot;
  config_versions?: ProspectusPage2ConfigVersionsSnapshot;
}

export interface ProspectusSnapshot {
  page_1: ProspectusPage1Snapshot;
  page_2?: ProspectusPage2Snapshot;
}

export interface NotePurposeSnapshot {
  financing_for: string;
}
