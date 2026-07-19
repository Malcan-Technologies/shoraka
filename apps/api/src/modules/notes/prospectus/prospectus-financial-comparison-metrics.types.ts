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
    formatter: "formatProspectusMoneyMyr";
    isCalculated: false;
  };
  profitAfterTax: {
    source: "rawFinancials.plnpat";
    formatter: "formatProspectusMoneyMyr";
    isCalculated: false;
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
    status: "unresolved";
    gearingSubstitutionAllowed: false;
  };
  interestCoverage: {
    status: "unresolved";
    structuredInputsAvailable: false;
  };
  dscr: {
    status: "unresolved";
    structuredInputsAvailable: false;
  };
  receivablesDays: {
    status: "unresolved";
    structuredInputsAvailable: false;
  };
  source: {
    inheritedFromStage4A: true;
    ctosUsed: false;
    sourceMixingAllowed: false;
  };
  units: {
    fullMyrRequired: true;
    compactMoneyAllowed: false;
    millionConversionAllowed: false;
  };
  snapshot: {
    isFrozen: false;
    snapshotDecision: "freeze_at_publication";
  };
}

export const PROSPECTUS_FINANCIAL_COMPARISON_METRICS_AUDIT: ProspectusFinancialComparisonMetricsAudit =
  {
    revenue: {
      source: "rawFinancials.turnover",
      formatter: "formatProspectusMoneyMyr",
      isCalculated: false,
    },
    profitAfterTax: {
      source: "rawFinancials.plnpat",
      formatter: "formatProspectusMoneyMyr",
      isCalculated: false,
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
      status: "unresolved",
      gearingSubstitutionAllowed: false,
    },
    interestCoverage: {
      status: "unresolved",
      structuredInputsAvailable: false,
    },
    dscr: {
      status: "unresolved",
      structuredInputsAvailable: false,
    },
    receivablesDays: {
      status: "unresolved",
      structuredInputsAvailable: false,
    },
    source: {
      inheritedFromStage4A: true,
      ctosUsed: false,
      sourceMixingAllowed: false,
    },
    units: {
      fullMyrRequired: true,
      compactMoneyAllowed: false,
      millionConversionAllowed: false,
    },
    snapshot: {
      isFrozen: false,
      snapshotDecision: "freeze_at_publication",
    },
  };

/** Complete Stage 4 financial comparison section (Stage 4A years + Stage 4B rows). */
export interface ProspectusFinancialComparisonMetrics {
  sectionHeading: string;
  tableUnitLabel: string;
  years: ProspectusFinancialComparisonSource["years"];
  rows: ProspectusFinancialComparisonMetricRow[];
  audit: ProspectusFinancialComparisonMetricsAudit;
}

/** Preferred input: Stage 4A source model only. */
export interface ProspectusFinancialComparisonMetricsInput {
  source: ProspectusFinancialComparisonSource;
  /** Observational — must never be read for metrics. */
  ctosFinancials?: unknown;
}
