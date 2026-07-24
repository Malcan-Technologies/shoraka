/**
 * SECTION: Prospectus Page 3 — Internal financial trend model
 * WHY: DNA trend slots for all Page 3 metrics; only ten Stage 5 coverage trends render in HTML
 */

import type { ProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet.types";
import {
  PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS,
  type ProspectusPageThreeBalanceSheetRowKey,
} from "./prospectus-page-three-balance-sheet.types";
import type { ProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency.types";
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
 * Future-only classification. approved = false for every metric.
 * Must never drive visible trend output.
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
  debt_equity: "context_dependent",
  return_on_equity: "higher_is_better_candidate",
  return_on_assets: "higher_is_better_candidate",
  receivables_days: "lower_is_better_candidate",
  payables_days: "context_dependent",
  asset_turnover: "higher_is_better_candidate",
};

export interface ProspectusPageThreeTrendItem {
  metricKey: ProspectusPageThreeTrendMetricKey;
  metricLabel: string;
  /** Always — until approved rules exist. */
  trend: string;
  /** Internal only — never rendered. */
  direction: null;
  /** Always — until approved rules exist. */
  interpretation: string;
  /** Audit/future only — not Canva-facing meaning. */
  candidateInterpretationClass: ProspectusPageThreeCandidateInterpretationClass;
  approved: false;
}

export interface ProspectusPageThreeTrendsAudit {
  source: {
    composedFromPageThreeSections: true;
    rawFinancialSourceReadDirectly: false;
    formattedValueReverseParsingAllowed: false;
  };
  rules: {
    approvedMetricSpecificRulesAvailable: false;
    genericHigherIsBetterAllowed: false;
    comparisonWindowDecisionAvailable: false;
    missingYearPolicyApproved: false;
    negativeValuePolicyApproved: false;
    thresholdPolicyApproved: false;
  };
  display: {
    arrowsAllowed: false;
    directionalColoursAllowed: false;
    generatedInterpretationAllowed: false;
  };
  snapshot: {
    trendOutputsFrozen: false;
    ruleVersionAvailable: false;
    snapshotDecision: "pending_product_finance_legal_approval";
  };
  futureInputs: {
    preferredSource: "frozen_raw_financial_values_and_approved_calculators";
    reverseParseFormattedDisplayStringsAllowed: false;
  };
}

export const PROSPECTUS_PAGE_THREE_TRENDS_AUDIT: ProspectusPageThreeTrendsAudit = {
  source: {
    composedFromPageThreeSections: true,
    rawFinancialSourceReadDirectly: false,
    formattedValueReverseParsingAllowed: false,
  },
  rules: {
    approvedMetricSpecificRulesAvailable: false,
    genericHigherIsBetterAllowed: false,
    comparisonWindowDecisionAvailable: false,
    missingYearPolicyApproved: false,
    negativeValuePolicyApproved: false,
    thresholdPolicyApproved: false,
  },
  display: {
    arrowsAllowed: false,
    directionalColoursAllowed: false,
    generatedInterpretationAllowed: false,
  },
  snapshot: {
    trendOutputsFrozen: false,
    ruleVersionAvailable: false,
    snapshotDecision: "pending_product_finance_legal_approval",
  },
  futureInputs: {
    preferredSource: "frozen_raw_financial_values_and_approved_calculators",
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
 * Compose completed Stage 2–4 section results only.
 * Display strings are never reverse-parsed into numbers.
 */
export interface ProspectusPageThreeTrendsInput {
  incomeStatement: ProspectusPageThreeIncomeStatement;
  balanceSheet: ProspectusPageThreeBalanceSheet;
  coverageEfficiency: ProspectusPageThreeCoverageEfficiency;
  /** Observational — must never fill trends. */
  ctosFinancials?: unknown;
}

export type {
  ProspectusPageThreeIncomeStatementRowKey,
  ProspectusPageThreeBalanceSheetRowKey,
  ProspectusPageThreeCoverageEfficiencyRowKey,
};
