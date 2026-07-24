/**
 * SECTION: Build Page 3 Stage 5 financial trend slots
 * WHY: One DNA trend per Stage 2–4 metric; no movement interpretation; no reverse-parsing
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_TREND_CANDIDATE_INTERPRETATION_CLASS,
  PROSPECTUS_PAGE_THREE_TREND_METRIC_KEYS,
  PROSPECTUS_PAGE_THREE_TRENDS_AUDIT,
  PROSPECTUS_PAGE_THREE_TRENDS_SECTION_HEADING,
  type ProspectusPageThreeTrendItem,
  type ProspectusPageThreeTrendMetricKey,
  type ProspectusPageThreeTrends,
  type ProspectusPageThreeTrendsInput,
} from "./prospectus-page-three-trends.types";

function metricLabelFromSections(
  key: ProspectusPageThreeTrendMetricKey,
  input: ProspectusPageThreeTrendsInput
): string {
  const fromIncome = input.incomeStatement.rows.find((row) => row.key === key);
  if (fromIncome) return fromIncome.label;
  const fromBalance = input.balanceSheet.rows.find((row) => row.key === key);
  if (fromBalance) return fromBalance.label;
  const fromCoverage = input.coverageEfficiency.rows.find((row) => row.key === key);
  if (fromCoverage) return fromCoverage.label;
  return PROSPECTUS_DATA_NOT_AVAILABLE;
}

/**
 * Builds structural trend slots only.
 * Does not compare year values, parse formatted money/percent/ratio strings,
 * or apply higher-is-better (or any) interpretation rules.
 */
export function buildProspectusPageThreeTrends(
  input: ProspectusPageThreeTrendsInput
): ProspectusPageThreeTrends {
  void input.ctosFinancials;
  // Section results are required for composition / label reuse only — never reverse-parsed.
  void input.incomeStatement.years;
  void input.balanceSheet.years;
  void input.coverageEfficiency.years;

  const trends: ProspectusPageThreeTrendItem[] = PROSPECTUS_PAGE_THREE_TREND_METRIC_KEYS.map(
    (metricKey) => ({
      metricKey,
      metricLabel: metricLabelFromSections(metricKey, input),
      trend: PROSPECTUS_DATA_NOT_AVAILABLE,
      direction: null,
      interpretation: PROSPECTUS_DATA_NOT_AVAILABLE,
      candidateInterpretationClass:
        PROSPECTUS_PAGE_THREE_TREND_CANDIDATE_INTERPRETATION_CLASS[metricKey],
      approved: false,
    })
  );

  return {
    sectionHeading: PROSPECTUS_PAGE_THREE_TRENDS_SECTION_HEADING,
    trends,
    audit: PROSPECTUS_PAGE_THREE_TRENDS_AUDIT,
  };
}
