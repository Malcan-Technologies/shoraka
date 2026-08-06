/**
 * SECTION: Prospectus Page 3 — Cash Flow, Coverage and Efficiency (visible Stage 5 metrics)
 * WHY: ROE via shared helper only; other rows DNA; Trend column composed in full Page 3 HTML
 */

import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SECTION_HEADING =
  "CASH FLOW, COVERAGE AND EFFICIENCY";

export const PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS = [
  "operating_cash_flow",
  "free_cash_flow",
  "interest_coverage",
  "dscr",
  "debt_equity",
  "return_on_equity",
  "return_on_assets",
  "receivables_days",
  "payables_days",
  "asset_turnover",
] as const;

export type ProspectusPageThreeCoverageEfficiencyRowKey =
  (typeof PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS)[number];

export const PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_LABELS: Record<
  ProspectusPageThreeCoverageEfficiencyRowKey,
  string
> = {
  operating_cash_flow: "Operating Cash Flow",
  free_cash_flow: "Free Cash Flow",
  interest_coverage: "Interest Coverage",
  dscr: "DSCR",
  debt_equity: "Debt / Equity",
  return_on_equity: "Return on Equity",
  return_on_assets: "Return on Assets",
  receivables_days: "Receivables Days",
  payables_days: "Payables Days",
  asset_turnover: "Asset Turnover",
};

export interface ProspectusPageThreeCoverageEfficiencyYear {
  year: number;
  yearLabel: string;
  financialYearEndLabel: string;
  /** Display-only column — excluded from approval officer-year lists. */
  isPlaceholder?: boolean;
}

export interface ProspectusPageThreeCoverageEfficiencyRow {
  key: ProspectusPageThreeCoverageEfficiencyRowKey;
  label: string;
  /** One formatted value per selected year, same order as Page 2 Stage 4A. */
  values: string[];
}

export interface ProspectusPageThreeCoverageEfficiencyAudit {
  source: {
    reusedFrom: "page_2_financial_comparison_source";
    independentYearSelectionAllowed: false;
    ctosFallbackAllowed: false;
  };
  operatingCashFlow: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.operatingCashFlow";
    storageUnit: "full_myr";
    formatter: "formatProspectusMyrMillions";
    requiredForApproval: true;
  };
  freeCashFlow: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.freeCashFlow";
    storageUnit: "full_myr";
    formatter: "formatProspectusMyrMillions";
    requiredForApproval: true;
  };
  interestCoverage: {
    status: "reused_from_page_2";
    source: "page2.financialComparison.overrides.{year}.interestCoverage";
    formatter: "formatProspectusFinancialMultiple";
    page3ManualStorageAllowed: false;
  };
  dscr: {
    status: "reused_from_page_2";
    source: "page2.financialComparison.overrides.{year}.dscr";
    formatter: "formatProspectusFinancialMultiple";
    page3ManualStorageAllowed: false;
  };
  debtEquity: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.debtEquity";
    calculateGearingSubstitutionAllowed: false;
    storageUnit: "ratio";
    formatter: "formatProspectusFinancialMultiple";
    requiredForApproval: true;
  };
  returnOnEquity: {
    status: "confirmed_shared_calculation";
    calculator: "resolveApplicationFinancialReturnOnEquityRatio";
    sharedWithPageTwo: true;
  };
  returnOnAssets: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.returnOnAssets";
    storageUnit: "percentage_points";
    formatter: "formatProspectusFinancialPercentFromPoints";
    requiredForApproval: true;
  };
  receivablesDays: {
    status: "reused_from_page_2";
    source: "page2.financialComparison.overrides.{year}.receivablesDays";
    formatter: "formatProspectusFinancialDays";
    page3ManualStorageAllowed: false;
  };
  payablesDays: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.payablesDays";
    storageUnit: "days";
    formatter: "formatProspectusFinancialDays";
    requiredForApproval: true;
  };
  assetTurnover: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.assetTurnover";
    storageUnit: "ratio";
    formatter: "formatProspectusFinancialMultiple";
    requiredForApproval: true;
  };
  trends: {
    implementedInThisStage: false;
    stage: "page_3_stage_5";
    display: "data_not_available";
  };
  snapshot: {
    currentSharedBranch: "page_2.financial_comparison";
    additionalFieldsRequiredForThisStage: false;
    liveFallbackForPublishedAllowed: false;
  };
}

export const PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT: ProspectusPageThreeCoverageEfficiencyAudit =
  {
    source: {
      reusedFrom: "page_2_financial_comparison_source",
      independentYearSelectionAllowed: false,
      ctosFallbackAllowed: false,
    },
    operatingCashFlow: {
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.operatingCashFlow",
      storageUnit: "full_myr",
      formatter: "formatProspectusMyrMillions",
      requiredForApproval: true,
    },
    freeCashFlow: {
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.freeCashFlow",
      storageUnit: "full_myr",
      formatter: "formatProspectusMyrMillions",
      requiredForApproval: true,
    },
    interestCoverage: {
      status: "reused_from_page_2",
      source: "page2.financialComparison.overrides.{year}.interestCoverage",
      formatter: "formatProspectusFinancialMultiple",
      page3ManualStorageAllowed: false,
    },
    dscr: {
      status: "reused_from_page_2",
      source: "page2.financialComparison.overrides.{year}.dscr",
      formatter: "formatProspectusFinancialMultiple",
      page3ManualStorageAllowed: false,
    },
    debtEquity: {
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.debtEquity",
      calculateGearingSubstitutionAllowed: false,
      storageUnit: "ratio",
      formatter: "formatProspectusFinancialMultiple",
      requiredForApproval: true,
    },
    returnOnEquity: {
      status: "confirmed_shared_calculation",
      calculator: "resolveApplicationFinancialReturnOnEquityRatio",
      sharedWithPageTwo: true,
    },
    returnOnAssets: {
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.returnOnAssets",
      storageUnit: "percentage_points",
      formatter: "formatProspectusFinancialPercentFromPoints",
      requiredForApproval: true,
    },
    receivablesDays: {
      status: "reused_from_page_2",
      source: "page2.financialComparison.overrides.{year}.receivablesDays",
      formatter: "formatProspectusFinancialDays",
      page3ManualStorageAllowed: false,
    },
    payablesDays: {
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.payablesDays",
      storageUnit: "days",
      formatter: "formatProspectusFinancialDays",
      requiredForApproval: true,
    },
    assetTurnover: {
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.assetTurnover",
      storageUnit: "ratio",
      formatter: "formatProspectusFinancialMultiple",
      requiredForApproval: true,
    },
    trends: {
      implementedInThisStage: false,
      stage: "page_3_stage_5",
      display: "data_not_available",
    },
    snapshot: {
      currentSharedBranch: "page_2.financial_comparison",
      additionalFieldsRequiredForThisStage: false,
      liveFallbackForPublishedAllowed: false,
    },
  };

export interface ProspectusPageThreeCoverageEfficiency {
  sectionHeading: string;
  years: ProspectusPageThreeCoverageEfficiencyYear[];
  rows: ProspectusPageThreeCoverageEfficiencyRow[];
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusPageThreeCoverageEfficiencyAudit;
}

export interface ProspectusPageThreeCoverageEfficiencyInput {
  /** Existing Page 2 Stage 4A result — required; never re-parsed here. */
  financialSource: ProspectusFinancialComparisonSource;
  /** Page 3 officer fills only (not IC / DSCR / Receivables Days / ROE). */
  prospectusFinancialInputs?: {
    years: Record<
      string,
      {
        operatingCashFlow?: number | string | null;
        freeCashFlow?: number | string | null;
        debtEquity?: number | string | null;
        /** Percentage points (4.8 = 4.8%). */
        returnOnAssets?: number | string | null;
        payablesDays?: number | string | null;
        assetTurnover?: number | string | null;
      }
    >;
  };
  /** Page 2 Financial Comparison officer overrides — authoritative for IC / DSCR / Receivables Days. */
  page2FinancialOverrides?: Record<
    string,
    {
      interestCoverage?: number | string | null;
      dscr?: number | string | null;
      receivablesDays?: number | string | null;
      netDebtEquity?: number | string | null;
    }
  > | null;
  /** Observational — must never fill years or cells. */
  ctosFinancials?: unknown;
}

export interface ProspectusPageThreeCoverageEfficiencyFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "calculated" | "unresolved" | "reused" | "officer";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_FIELD_SOURCES: Record<
  ProspectusPageThreeCoverageEfficiencyRowKey | "sectionHeading" | "years",
  ProspectusPageThreeCoverageEfficiencyFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "CASH FLOW, COVERAGE AND EFFICIENCY",
  },
  years: {
    label: "Selected financial years",
    canonicalSource: "page_2_financial_comparison_source.years",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "Independent Page 3 year selection; CTOS — not used",
    notes: "Pass-through year / yearLabel / financialYearEndLabel only. No Trend column.",
  },
  operating_cash_flow: {
    label: "Operating Cash Flow",
    canonicalSource: "page3.manualFinancialInputs.years.{year}.operatingCashFlow",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "PAT/depreciation/WC identities — not used",
    notes: "Full MYR storage; formatProspectusMyrMillions display.",
  },
  free_cash_flow: {
    label: "Free Cash Flow",
    canonicalSource: "page3.manualFinancialInputs.years.{year}.freeCashFlow",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "OCF − capex — not used",
    notes: "Full MYR storage; formatProspectusMyrMillions display.",
  },
  interest_coverage: {
    label: "Interest Coverage",
    canonicalSource: "page2.financialComparison.overrides.{year}.interestCoverage",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "page3.manualFinancialInputs.interestCoverage — removed",
    notes: "Same Page 2 officer value and Nx formatter.",
  },
  dscr: {
    label: "DSCR",
    canonicalSource: "page2.financialComparison.overrides.{year}.dscr",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "page3.manualFinancialInputs.dscr — removed",
    notes: "Same Page 2 officer value and Nx formatter.",
  },
  debt_equity: {
    label: "Debt / Equity",
    canonicalSource: "page3.manualFinancialInputs.years.{year}.debtEquity",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "calculateGearing; Page 2 Net Debt / Equity — not used",
    notes: "Raw multiple storage; formatProspectusFinancialMultiple display.",
  },
  return_on_equity: {
    label: "Return on Equity",
    canonicalSource:
      "resolveApplicationFinancialReturnOnEquityRatio(return_on_equity | plnpat/networth | plnpat/(resolved totass−totlib from flat or components))",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "plnpat/bsqpuc (Paid-Up Capital) — not used",
    notes:
      "Prefer CTOS return_on_equity; else PAT ÷ networth; else PAT ÷ (totass − totlib); never Paid-Up Capital.",
  },
  return_on_assets: {
    label: "Return on Assets",
    canonicalSource: "page3.manualFinancialInputs.years.{year}.returnOnAssets",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "PAT / Total Assets — not approved",
    notes: "storageUnit = percentage_points (4.8 → 4.8%).",
  },
  receivables_days: {
    label: "Receivables Days",
    canonicalSource: "page2.financialComparison.overrides.{year}.receivablesDays",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "page3.manualFinancialInputs.receivablesDays — removed",
    notes: "Same Page 2 whole-number days value.",
  },
  payables_days: {
    label: "Payables Days",
    canonicalSource: "page3.manualFinancialInputs.years.{year}.payablesDays",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "Numeric days storage; plain number display.",
  },
  asset_turnover: {
    label: "Asset Turnover",
    canonicalSource: "page3.manualFinancialInputs.years.{year}.assetTurnover",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "Revenue ÷ Total Assets — not approved",
    notes: "Raw multiple storage; formatProspectusFinancialMultiple display.",
  },
};
