/**
 * SECTION: Prospectus Page 3 — Coverage Trend (3-Yr) model
 * WHY: Approved Heroicon trends for coverage rows; income/balance slots stay unavailable
 */

import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import type { ProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet.types";
import {
  PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS,
  type ProspectusPageThreeBalanceSheetRowKey,
} from "./prospectus-page-three-balance-sheet.types";
import type {
  ProspectusPageThreeCoverageEfficiency,
  ProspectusPageThreeCoverageEfficiencyInput,
} from "./prospectus-page-three-coverage-efficiency.types";
import {
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS,
  type ProspectusPageThreeCoverageEfficiencyRowKey,
} from "./prospectus-page-three-coverage-efficiency.types";
import type { ProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement.types";
import {
  PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS,
  type ProspectusPageThreeIncomeStatementRowKey,
} from "./prospectus-page-three-income-statement.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type {
  ProspectusTrendConsistency,
  ProspectusTrendDirection,
  ProspectusTrendInterpretation,
} from "./prospectus-trend-direction";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/**
 * Internal model heading only — not rendered as a standalone Page 3 section.
 * Canva places trends as the Stage 5 "Trend (3-Yr)" column on coverage/efficiency rows.
 */
export const PROSPECTUS_PAGE_THREE_TRENDS_SECTION_HEADING = "FINANCIAL TRENDS";

/**
 * Internal 26-metric trend model (income + balance + coverage).
 * Full Page 3 HTML renders only the ten coverage/efficiency trend values in Stage 5.
 */
export const PROSPECTUS_PAGE_THREE_TREND_METRIC_KEYS = [
  ...PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS,
  ...PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS,
  ...PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS,
] as const;

export type ProspectusPageThreeTrendMetricKey =
  (typeof PROSPECTUS_PAGE_THREE_TREND_METRIC_KEYS)[number];

export type ProspectusPageThreeCandidateInterpretationClass =
  | "higher_is_better_candidate"
  | "lower_is_better_candidate"
  | "context_dependent";

/**
 * Interpretation catalogue for coverage trends (approved).
 * debt_equity is lower-is-favourable (not context-dependent).
 */
export const PROSPECTUS_PAGE_THREE_TREND_CANDIDATE_INTERPRETATION_CLASS: Record<
  ProspectusPageThreeTrendMetricKey,
  ProspectusPageThreeCandidateInterpretationClass
> = {
  revenue: "higher_is_better_candidate",
  gross_profit: "higher_is_better_candidate",
  ebitda: "higher_is_better_candidate",
  ebit: "higher_is_better_candidate",
  profit_before_tax: "higher_is_better_candidate",
  profit_after_tax: "higher_is_better_candidate",
  net_profit_margin: "higher_is_better_candidate",
  cash_and_bank: "context_dependent",
  trade_receivables: "context_dependent",
  current_assets: "context_dependent",
  total_assets: "context_dependent",
  current_liabilities: "context_dependent",
  total_liabilities: "context_dependent",
  total_equity: "context_dependent",
  current_ratio: "context_dependent",
  quick_ratio: "context_dependent",
  operating_cash_flow: "higher_is_better_candidate",
  free_cash_flow: "higher_is_better_candidate",
  interest_coverage: "higher_is_better_candidate",
  dscr: "higher_is_better_candidate",
  debt_equity: "lower_is_better_candidate",
  return_on_equity: "higher_is_better_candidate",
  return_on_assets: "higher_is_better_candidate",
  receivables_days: "lower_is_better_candidate",
  payables_days: "context_dependent",
  asset_turnover: "higher_is_better_candidate",
};

export interface ProspectusPageThreeTrendItem {
  metricKey: ProspectusPageThreeTrendMetricKey;
  metricLabel: string;
  /** Formatted cell content helper — "—" when unavailable. */
  trend: string;
  direction: ProspectusTrendDirection;
  consistency: ProspectusTrendConsistency;
  interpretation: ProspectusTrendInterpretation;
  accessibleLabel: string;
  candidateInterpretationClass: ProspectusPageThreeCandidateInterpretationClass;
  /** True when a Heroicon trend is approved for HTML/PDF freeze. */
  approved: boolean;
}

export interface ProspectusPageThreeTrendsAudit {
  source: {
    composedFromPageThreeSections: true;
    coverageNumericFromSameSourcesAsDisplay: true;
    formattedValueReverseParsingAllowed: false;
  };
  rules: {
    approvedMetricSpecificRulesAvailable: true;
    coverageOnlyCalculation: true;
    threeYearRequirement: true;
    neutralRelativeThreshold: 0.01;
    physicalArrowNotReversedForFavourability: true;
  };
  display: {
    arrowsAllowed: true;
    heroiconsRequired: true;
    directionalColoursAllowed: true;
    generatedInterpretationAllowed: false;
  };
  snapshot: {
    trendOutputsFrozen: true;
    ruleVersionAvailable: true;
    snapshotDecision: "frozen_into_approved_html";
  };
  futureInputs: {
    preferredSource: "same_numeric_sources_as_displayed_coverage_cells";
    reverseParseFormattedDisplayStringsAllowed: false;
  };
}

export const PROSPECTUS_PAGE_THREE_TRENDS_AUDIT: ProspectusPageThreeTrendsAudit = {
  source: {
    composedFromPageThreeSections: true,
    coverageNumericFromSameSourcesAsDisplay: true,
    formattedValueReverseParsingAllowed: false,
  },
  rules: {
    approvedMetricSpecificRulesAvailable: true,
    coverageOnlyCalculation: true,
    threeYearRequirement: true,
    neutralRelativeThreshold: 0.01,
    physicalArrowNotReversedForFavourability: true,
  },
  display: {
    arrowsAllowed: true,
    heroiconsRequired: true,
    directionalColoursAllowed: true,
    generatedInterpretationAllowed: false,
  },
  snapshot: {
    trendOutputsFrozen: true,
    ruleVersionAvailable: true,
    snapshotDecision: "frozen_into_approved_html",
  },
  futureInputs: {
    preferredSource: "same_numeric_sources_as_displayed_coverage_cells",
    reverseParseFormattedDisplayStringsAllowed: false,
  },
};

export interface ProspectusPageThreeTrends {
  sectionHeading: string;
  trends: ProspectusPageThreeTrendItem[];
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusPageThreeTrendsAudit;
}

/**
 * Coverage trends use the same numeric sources as displayed cells.
 * Display strings are never reverse-parsed into numbers.
 */
export interface ProspectusPageThreeTrendsInput {
  incomeStatement: ProspectusPageThreeIncomeStatement;
  balanceSheet: ProspectusPageThreeBalanceSheet;
  coverageEfficiency: ProspectusPageThreeCoverageEfficiency;
  financialSource: ProspectusFinancialComparisonSource;
  prospectusFinancialInputs?: ProspectusPageThreeCoverageEfficiencyInput["prospectusFinancialInputs"];
  page2FinancialOverrides?: ProspectusPageThreeCoverageEfficiencyInput["page2FinancialOverrides"];
  /** Observational — must never fill trends. */
  ctosFinancials?: unknown;
}

export type {
  ProspectusPageThreeIncomeStatementRowKey,
  ProspectusPageThreeBalanceSheetRowKey,
  ProspectusPageThreeCoverageEfficiencyRowKey,
};
