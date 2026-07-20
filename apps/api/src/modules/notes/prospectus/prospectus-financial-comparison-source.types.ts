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
  | "unaudited_management";

export interface ProspectusFinancialComparisonYear {
  year: number;
  yearLabel: string;
  financialYearEndLabel: string;
  /** Stable override key — normalized financial-year-end ISO date. */
  financialYearEndIso: string;
  recordSource: ProspectusFinancialComparisonRecordSource;
  /** Original source fields for Stage 4B — not Canva-facing alone. */
  rawFinancials: Record<string, unknown>;
}

export interface ProspectusFinancialComparisonSourceAudit {
  source: {
    selectedSource: "admin_financial_statements_normalized";
    path: "ctos.financials_json + applications.financial_statements (SSM window)";
    ctosUsed: true;
    sourceMixingAllowed: true;
    precedence: "ctos_audited_over_unaudited_same_year";
  };
  years: {
    selectionRule: "normalized_admin_set_then_latest_three";
    sortForSelection: "descending";
    displayOrder: "ascending";
    invalidYearKeysIgnored: true;
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
      precedence: "ctos_audited_over_unaudited_same_year",
    },
    years: {
      selectionRule: "normalized_admin_set_then_latest_three",
      sortForSelection: "descending",
      displayOrder: "ascending",
      invalidYearKeysIgnored: true,
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
      "CTOS latest 3 + SSM unaudited non-overlap; CTOS precedence; latest 3; ascending display; FYE ISO override keys.",
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
