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
    status: "unresolved";
    directRawFieldAvailable: false;
    generatedCalculationAllowed: false;
  };
  freeCashFlow: {
    status: "unresolved";
    operatingCashFlowAvailable: false;
    capitalExpenditureAvailable: false;
    generatedCalculationAllowed: false;
  };
  interestCoverage: {
    status: "unresolved";
    approvedNumeratorDefinitionAvailable: false;
    financeCostInputAvailable: false;
    generatedCalculationAllowed: false;
  };
  dscr: {
    status: "unresolved";
    approvedDefinitionAvailable: false;
    debtServiceInputAvailable: false;
    generatedCalculationAllowed: false;
  };
  debtEquity: {
    status: "unresolved";
    calculateGearingSubstitutionAllowed: false;
    bsqpucIsTotalEquity: false;
    approvedDebtDefinitionAvailable: false;
  };
  returnOnEquity: {
    status: "confirmed_shared_calculation";
    calculator: "calculateReturnOnEquity";
    sharedWithPageTwo: true;
  };
  returnOnAssets: {
    status: "unresolved";
    averageAssetsDecisionAvailable: false;
    generatedCalculationAllowed: false;
  };
  receivablesDays: {
    status: "unresolved";
    tradeReceivablesInputAvailable: false;
  };
  payablesDays: {
    status: "unresolved";
    tradePayablesInputAvailable: false;
    purchaseOrCostInputAvailable: false;
  };
  assetTurnover: {
    status: "unresolved";
    averageAssetsDecisionAvailable: false;
    generatedCalculationAllowed: false;
  };
  trends: {
    implementedInThisStage: false;
    stage: "page_3_stage_5";
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
      status: "unresolved",
      directRawFieldAvailable: false,
      generatedCalculationAllowed: false,
    },
    freeCashFlow: {
      status: "unresolved",
      operatingCashFlowAvailable: false,
      capitalExpenditureAvailable: false,
      generatedCalculationAllowed: false,
    },
    interestCoverage: {
      status: "unresolved",
      approvedNumeratorDefinitionAvailable: false,
      financeCostInputAvailable: false,
      generatedCalculationAllowed: false,
    },
    dscr: {
      status: "unresolved",
      approvedDefinitionAvailable: false,
      debtServiceInputAvailable: false,
      generatedCalculationAllowed: false,
    },
    debtEquity: {
      status: "unresolved",
      calculateGearingSubstitutionAllowed: false,
      bsqpucIsTotalEquity: false,
      approvedDebtDefinitionAvailable: false,
    },
    returnOnEquity: {
      status: "confirmed_shared_calculation",
      calculator: "calculateReturnOnEquity",
      sharedWithPageTwo: true,
    },
    returnOnAssets: {
      status: "unresolved",
      averageAssetsDecisionAvailable: false,
      generatedCalculationAllowed: false,
    },
    receivablesDays: {
      status: "unresolved",
      tradeReceivablesInputAvailable: false,
    },
    payablesDays: {
      status: "unresolved",
      tradePayablesInputAvailable: false,
      purchaseOrCostInputAvailable: false,
    },
    assetTurnover: {
      status: "unresolved",
      averageAssetsDecisionAvailable: false,
      generatedCalculationAllowed: false,
    },
    trends: {
      implementedInThisStage: false,
      stage: "page_3_stage_5",
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
  /** Temporary builder-only fills for unsupported rows only (not ROE). */
  prospectusFinancialInputs?: {
    years: Record<
      string,
      {
        operatingCashFlow?: number | string | null;
        freeCashFlow?: number | string | null;
        interestCoverage?: number | string | null;
        dscr?: number | string | null;
        debtEquity?: number | string | null;
        returnOnAssets?: number | string | null;
        receivablesDays?: number | string | null;
        payablesDays?: number | string | null;
        assetTurnover?: number | string | null;
      }
    >;
  };
  /** Observational — must never fill years or cells. */
  ctosFinancials?: unknown;
}

export interface ProspectusPageThreeCoverageEfficiencyFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "calculated" | "unresolved" | "reused";
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
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "PAT/depreciation/WC identities — not used",
    notes: "No OCF field in Application FS 14-key shape.",
  },
  free_cash_flow: {
    label: "Free Cash Flow",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "OCF − capex; Δbsfatot — not used",
    notes: "OCF and capital expenditure unavailable.",
  },
  interest_coverage: {
    label: "Interest Coverage",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "PBT/PAT as EBIT proxy — not used",
    notes: "No approved shared helper or finance-cost input.",
  },
  dscr: {
    label: "DSCR",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Note repayments; liabilities — not used",
    notes: "No CashSouk DSCR definition or debt-service input.",
  },
  debt_equity: {
    label: "Debt / Equity",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "calculateGearing; totlib/bsqpuc — rejected",
    notes: "Page 2 rejected gearing substitute. bsqpuc is Paid-Up Capital.",
  },
  return_on_equity: {
    label: "Return on Equity",
    canonicalSource: "calculateReturnOnEquity(plnpat, bsqpuc)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "Local duplicate formula — not used",
    notes:
      "Same helper + percent formatter as Page 2 Stage 4B. Denominator is paid-up capital key.",
  },
  return_on_assets: {
    label: "Return on Assets",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "PAT / Total Assets — not approved",
    notes: "Average vs closing assets undecided.",
  },
  receivables_days: {
    label: "Receivables Days",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "bscatot as receivables — not used",
    notes: "Trade receivables field unavailable.",
  },
  payables_days: {
    label: "Payables Days",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "curlib as payables — not used",
    notes: "Trade payables and purchases/COGS unavailable.",
  },
  asset_turnover: {
    label: "Asset Turnover",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "turnover / Total Assets — not approved",
    notes: "Average vs closing assets undecided.",
  },
};
