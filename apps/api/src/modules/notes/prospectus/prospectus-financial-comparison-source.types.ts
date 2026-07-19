/**
 * SECTION: Prospectus Page 2 — 3-Year Financial Comparison Source (DATA STAGE 4A)
 * WHY: Application unaudited years only; year selection/order; no metrics; no CTOS
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING = "3-YEAR FINANCIAL COMPARISON";

export const PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS = 3;

export interface ProspectusFinancialComparisonYear {
  year: number;
  yearLabel: string;
  financialYearEndLabel: string;
  /** Original unaudited_by_year[year] object for Stage 4B — not Canva-facing alone. */
  rawFinancials: Record<string, unknown>;
}

export interface ProspectusFinancialComparisonSourceAudit {
  source: {
    selectedSource: "application_financial_statements";
    path: "applications.financial_statements.unaudited_by_year";
    ctosUsed: false;
    sourceMixingAllowed: false;
  };
  years: {
    selectionRule: "latest_three_valid_years";
    sortForSelection: "descending";
    displayOrder: "ascending";
    invalidYearKeysIgnored: true;
    maxYears: 3;
  };
  financialYearEnd: {
    source: "applications.financial_statements.questionnaire.financial_year_end";
    hardcodedDecemberAllowed: false;
  };
  tableUnits: {
    compactMoneyAllowed: false;
    fullMyrRequired: true;
    millionConversionAllowed: false;
    unitLabelDecision: "unavailable";
  };
  sourceNote: {
    status: "unresolved";
    auditedClaimAllowed: false;
    managementAccountClaimAllowed: false;
  };
  snapshot: {
    sourceType: "live_application_financial_statements";
    isFrozen: false;
    snapshotDecision: "freeze_at_publication";
  };
}

export const PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT: ProspectusFinancialComparisonSourceAudit =
  {
    source: {
      selectedSource: "application_financial_statements",
      path: "applications.financial_statements.unaudited_by_year",
      ctosUsed: false,
      sourceMixingAllowed: false,
    },
    years: {
      selectionRule: "latest_three_valid_years",
      sortForSelection: "descending",
      displayOrder: "ascending",
      invalidYearKeysIgnored: true,
      maxYears: 3,
    },
    financialYearEnd: {
      source: "applications.financial_statements.questionnaire.financial_year_end",
      hardcodedDecemberAllowed: false,
    },
    tableUnits: {
      compactMoneyAllowed: false,
      fullMyrRequired: true,
      millionConversionAllowed: false,
      unitLabelDecision: "unavailable",
    },
    sourceNote: {
      status: "unresolved",
      auditedClaimAllowed: false,
      managementAccountClaimAllowed: false,
    },
    snapshot: {
      sourceType: "live_application_financial_statements",
      isFrozen: false,
      snapshotDecision: "freeze_at_publication",
    },
  };

/** Canva-facing Stage 4A fields (metrics belong to Stage 4B). */
export interface ProspectusFinancialComparisonSource {
  sectionHeading: string;
  tableUnitLabel: string;
  years: ProspectusFinancialComparisonYear[];
  sourceNote: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusFinancialComparisonSourceAudit;
}

/**
 * Application financial statements only.
 * Observational CTOS / mixed inputs prove they are never selected.
 */
export interface ProspectusFinancialComparisonSourceInput {
  /** applications.financial_statements */
  financialStatements?: unknown;
  /** Observational — must never be selected or mixed in. */
  ctosFinancials?: unknown;
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
  "sectionHeading" | "tableUnitLabel" | "years" | "sourceNote",
  ProspectusFinancialComparisonSourceFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "3-YEAR FINANCIAL COMPARISON",
  },
  tableUnitLabel: {
    label: "Table unit label",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "(MYR mil.); compact mil — not used",
    notes: "Full MYR in Stage 4B cells. Unit label unavailable.",
  },
  years: {
    label: "Financial years",
    canonicalSource: "applications.financial_statements.unaudited_by_year",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "CTOS financials_json — not used; no source mixing",
    notes:
      "Latest three valid 4-digit year keys; select descending; display ascending as FY{year}.",
  },
  sourceNote: {
    label: "Source note",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Audited Financial Statements; Management Account — not used",
    notes: "Application unaudited source does not prove Canva audited wording.",
  },
};
