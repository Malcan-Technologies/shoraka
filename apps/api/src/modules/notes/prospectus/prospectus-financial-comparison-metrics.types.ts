/**
 * SECTION: Prospectus Page 2 — 3-Year Financial Comparison Metrics (DATA STAGE 4B)
 * WHY: Supported helpers only; gearing ≠ Net Debt/Equity; CTOS/mixing forbidden
 */

import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export const PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS = [
  "revenue",
  "profitAfterTax",
  "netProfitMargin",
  "roe",
  "currentRatio",
  "netDebtEquity",
  "interestCoverage",
  "dscr",
  "receivablesDays",
] as const;

export type ProspectusFinancialComparisonMetricKey =
  (typeof PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS)[number];

export const PROSPECTUS_FINANCIAL_COMPARISON_METRIC_LABELS: Record<
  ProspectusFinancialComparisonMetricKey,
  string
> = {
  revenue: "Revenue",
  profitAfterTax: "Profit After Tax",
  netProfitMargin: "Net Profit Margin",
  roe: "ROE",
  currentRatio: "Current Ratio",
  netDebtEquity: "Net Debt / Equity",
  interestCoverage: "Interest Coverage",
  dscr: "DSCR",
  receivablesDays: "Receivables Days",
};

export interface ProspectusFinancialComparisonMetricRow {
  key: ProspectusFinancialComparisonMetricKey;
  label: string;
  /** One formatted value per Stage 4A year, same order. */
  values: string[];
}

export interface ProspectusFinancialComparisonMetricsAudit {
  revenue: {
    source: "rawFinancials.turnover";
    formatter: "formatProspectusMyrMillions";
    isCalculated: false;
    formulasUseFullMyr: true;
  };
  profitAfterTax: {
    source: "rawFinancials.plnpat";
    formatter: "formatProspectusMyrMillions";
    isCalculated: false;
    formulasUseFullMyr: true;
  };
  netProfitMargin: {
    helper: "calculateProfitMargin";
    formulaOwnedBySharedHelper: true;
    isCalculated: true;
  };
  roe: {
    helper: "calculateReturnOnEquity";
    formulaOwnedBySharedHelper: true;
    isCalculated: true;
  };
  currentRatio: {
    helper: "calculateCurrentRatio";
    formulaOwnedBySharedHelper: true;
    isCalculated: true;
  };
  netDebtEquity: {
    status: "officer_or_dna";
    gearingSubstitutionAllowed: false;
    officerSource: "prospectus_review.page2.financialComparison.overrides.netDebtEquity";
  };
  interestCoverage: {
    status: "officer_or_dna";
    structuredInputsAvailable: false;
    officerSource: "prospectus_review.page2.financialComparison.overrides.interestCoverage";
  };
  dscr: {
    status: "officer_or_dna";
    structuredInputsAvailable: false;
    officerSource: "prospectus_review.page2.financialComparison.overrides.dscr";
  };
  receivablesDays: {
    status: "officer_or_dna";
    structuredInputsAvailable: false;
    officerSource: "prospectus_review.page2.financialComparison.overrides.receivablesDays";
  };
  source: {
    inheritedFromStage4A: true;
    ctosUsed: true;
    sourceMixingAllowed: true;
  };
  units: {
    fullMyrRequired: true;
    compactMoneyAllowed: false;
    millionConversionAllowed: "display_only_revenue_pat";
  };
  snapshot: {
    isFrozen: false;
    snapshotDecision: "freeze_at_approval";
  };
}

export const PROSPECTUS_FINANCIAL_COMPARISON_METRICS_AUDIT: ProspectusFinancialComparisonMetricsAudit =
  {
    revenue: {
      source: "rawFinancials.turnover",
      formatter: "formatProspectusMyrMillions",
      isCalculated: false,
      formulasUseFullMyr: true,
    },
    profitAfterTax: {
      source: "rawFinancials.plnpat",
      formatter: "formatProspectusMyrMillions",
      isCalculated: false,
      formulasUseFullMyr: true,
    },
    netProfitMargin: {
      helper: "calculateProfitMargin",
      formulaOwnedBySharedHelper: true,
      isCalculated: true,
    },
    roe: {
      helper: "calculateReturnOnEquity",
      formulaOwnedBySharedHelper: true,
      isCalculated: true,
    },
    currentRatio: {
      helper: "calculateCurrentRatio",
      formulaOwnedBySharedHelper: true,
      isCalculated: true,
    },
    netDebtEquity: {
      status: "officer_or_dna",
      gearingSubstitutionAllowed: false,
      officerSource: "prospectus_review.page2.financialComparison.overrides.netDebtEquity",
    },
    interestCoverage: {
      status: "officer_or_dna",
      structuredInputsAvailable: false,
      officerSource: "prospectus_review.page2.financialComparison.overrides.interestCoverage",
    },
    dscr: {
      status: "officer_or_dna",
      structuredInputsAvailable: false,
      officerSource: "prospectus_review.page2.financialComparison.overrides.dscr",
    },
    receivablesDays: {
      status: "officer_or_dna",
      structuredInputsAvailable: false,
      officerSource: "prospectus_review.page2.financialComparison.overrides.receivablesDays",
    },
    source: {
      inheritedFromStage4A: true,
      ctosUsed: true,
      sourceMixingAllowed: true,
    },
    units: {
      fullMyrRequired: true,
      compactMoneyAllowed: false,
      millionConversionAllowed: "display_only_revenue_pat",
    },
    snapshot: {
      isFrozen: false,
      snapshotDecision: "freeze_at_approval",
    },
  };

/** Complete Stage 4 financial comparison section (Stage 4A years + Stage 4B rows). */
export interface ProspectusFinancialComparisonMetrics {
  sectionHeading: string;
  tableUnitLabel: string;
  sourceFooter: string;
  years: ProspectusFinancialComparisonSource["years"];
  rows: ProspectusFinancialComparisonMetricRow[];
  audit: ProspectusFinancialComparisonMetricsAudit;
}

/** Officer-entered values for unsupported Stage 4B metrics (per year). */
export interface ProspectusFinancialComparisonYearOfficerOverride {
  netDebtEquity?: string | number | null;
  interestCoverage?: string | number | null;
  dscr?: string | number | null;
  receivablesDays?: string | number | null;
}

/** Preferred input: Stage 4A source model + optional officer overrides. */
export interface ProspectusFinancialComparisonMetricsInput {
  source: ProspectusFinancialComparisonSource;
  /**
   * Officer overrides keyed by calendar year ("2024") and/or FYE ISO ("2024-12-31").
   * Never applied to system-derived metrics.
   */
  officerOverrides?: Record<string, ProspectusFinancialComparisonYearOfficerOverride> | null;
  /** Observational — must never be read for metrics. */
  ctosFinancials?: unknown;
}
