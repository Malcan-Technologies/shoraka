/**
 * SECTION: Prospectus Page 2 — 3-Year Financial Comparison Source (DATA STAGE 4A)
 * WHY: Same normalized year set as Admin Financial Statements; max 3; oldest→newest
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — includes table unit per confirmed Canva heading. */
export const PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING =
  "3-YEAR FINANCIAL COMPARISON (MYR mil.)";

export const PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL = "(MYR mil.)";

export const PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS = 3;

export type ProspectusFinancialComparisonRecordSource =
  | "ctos_audited"
  | "unaudited_management"
  | "admin_input";

export type ProspectusFinancialComparisonStatementType =
  | "AUDITED"
  | "NOT_AUDITED"
  | "MANAGEMENT_ACCOUNTS";

export interface ProspectusFinancialComparisonYear {
  year: number;
  yearLabel: string;
  financialYearEndLabel: string;
  /** Stable override key — normalized financial-year-end ISO date. */
  financialYearEndIso: string;
  recordSource: ProspectusFinancialComparisonRecordSource;
  statementType: ProspectusFinancialComparisonStatementType;
  /** Original source fields for Stage 4B — not Canva-facing alone. */
  rawFinancials: Record<string, unknown>;
  /**
   * Prospectus display-only column with no real normalized financial record.
   * Never stored, never approval-required, never used for trend numerics.
   */
  isPlaceholder?: boolean;
  /**
   * True for placeholder years that are eligible for Admin `admin_input_by_year`
   * fallback inside the existing shared FY window.
   */
  adminFallbackEligible?: boolean;
}

export interface ProspectusFinancialComparisonSourceAudit {
  source: {
    selectedSource: "admin_financial_statements_normalized";
    path: "ctos.financials_json + applications.financial_statements (SSM window)";
    ctosUsed: true;
    sourceMixingAllowed: true;
    precedence: "reviewed_user_input_then_ctos_then_active_admin_input";
  };
  years: {
    selectionRule: "latest_three_distinct_fy_user_then_ctos_then_admin";
    sortForSelection: "descending";
    displayOrder: "ascending";
    invalidYearKeysIgnored: true;
    emptySsmExpectedYearsOmitted: true;
    maxYears: 3;
  };
  financialYearEnd: {
    source: "pldd_or_questionnaire.financial_year_end";
    hardcodedDecemberAllowed: false;
    overrideKey: "financial_year_end_iso";
  };
  tableUnits: {
    compactMoneyAllowed: false;
    fullMyrRequired: true;
    millionConversionAllowed: "display_only";
    unitLabelDecision: "myr_mil_in_heading";
  };
  snapshot: {
    sourceType: "live_normalized_financial_statements";
    isFrozen: false;
    snapshotDecision: "freeze_at_approval";
  };
}

export const PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT: ProspectusFinancialComparisonSourceAudit =
  {
    source: {
      selectedSource: "admin_financial_statements_normalized",
      path: "ctos.financials_json + applications.financial_statements (SSM window)",
      ctosUsed: true,
      sourceMixingAllowed: true,
      precedence: "reviewed_user_input_then_ctos_then_active_admin_input",
    },
    years: {
      selectionRule: "latest_three_distinct_fy_user_then_ctos_then_admin",
      sortForSelection: "descending",
      displayOrder: "ascending",
      invalidYearKeysIgnored: true,
      emptySsmExpectedYearsOmitted: true,
      maxYears: 3,
    },
    financialYearEnd: {
      source: "pldd_or_questionnaire.financial_year_end",
      hardcodedDecemberAllowed: false,
      overrideKey: "financial_year_end_iso",
    },
    tableUnits: {
      compactMoneyAllowed: false,
      fullMyrRequired: true,
      millionConversionAllowed: "display_only",
      unitLabelDecision: "myr_mil_in_heading",
    },
    snapshot: {
      sourceType: "live_normalized_financial_statements",
      isFrozen: false,
      snapshotDecision: "freeze_at_approval",
    },
  };

/** Canva-facing Stage 4A fields (metrics belong to Stage 4B). */
export interface ProspectusFinancialComparisonSource {
  sectionHeading: string;
  tableUnitLabel: string;
  sourceFooter: string;
  years: ProspectusFinancialComparisonYear[];
  /** Eligibility for Admin to add an `admin_input_by_year` fallback inside the shared FY window. */
  adminFallbackEligibleYears: number[];
  /**
   * SSM-expected unaudited years with no stored actual data (and no CTOS coverage).
   * Admin Ops only — never shown on investor HTML and never blocks approval.
   */
  missingSsmUnauditedYears: number[];
  /** Non-blocking Admin warning when `missingSsmUnauditedYears` is non-empty. */
  opsWarning: string | null;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusFinancialComparisonSourceAudit;
}

/**
 * Application financial statements + organization CTOS financials_json.
 * Year set matches Admin Financial Statements tab (then capped at three).
 */
export interface ProspectusFinancialComparisonSourceInput {
  /** applications.financial_statements */
  financialStatements?: unknown;
  /** Organization CTOS financials_json (array) — same as Admin Financial Statements. */
  ctosFinancials?: unknown;
  /** Reference date for SSM six-month deadline (tests). */
  ref?: Date;
}

export interface ProspectusFinancialComparisonSourceFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "calculated" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_FIELD_SOURCES: Record<
  "sectionHeading" | "tableUnitLabel" | "years" | "sourceFooter",
  ProspectusFinancialComparisonSourceFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "3-YEAR FINANCIAL COMPARISON (MYR mil.)",
  },
  tableUnitLabel: {
    label: "Table unit label",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "(MYR mil.) — Revenue/PAT display divide by 1e6 only",
  },
  years: {
    label: "Financial years",
    canonicalSource: "admin_financial_statements_normalized",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "none",
    notes:
      "Latest three distinct FYs. Each FY: reviewed User Input (including Admin edits), else CTOS plus explicit CTOS gap-fills, else active Admin Input, else blank. Superseded Admin Input is not a source. Missing SSM years → Admin ops warning only.",
  },
  sourceFooter: {
    label: "Source footer",
    canonicalSource: "selected_year_record_sources",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "neutral Financial Statements when empty",
    notes: "Audited / Management Accounts / mixed — never unsupported audited claim",
  },
};
