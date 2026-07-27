/**
 * SECTION: Build Page 3 Stage 5 financial trend slots
 * WHY: Coverage rows use approved oldest→newest Heroicon rules; other metrics stay unavailable
 */

import { numericValueForCoverageRow } from "./prospectus-page-three-coverage-efficiency";
import {
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS,
  type ProspectusPageThreeCoverageEfficiencyRowKey,
} from "./prospectus-page-three-coverage-efficiency.types";
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
import {
  PROSPECTUS_COVERAGE_TREND_MEANING,
  computeProspectusTrendDirection,
} from "./prospectus-trend-direction";

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

function isCoverageTrendKey(
  key: ProspectusPageThreeTrendMetricKey
): key is ProspectusPageThreeCoverageEfficiencyRowKey {
  return (PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS as readonly string[]).includes(
    key
  );
}

function unavailableTrend(
  metricKey: ProspectusPageThreeTrendMetricKey,
  metricLabel: string
): ProspectusPageThreeTrendItem {
  return {
    metricKey,
    metricLabel,
    trend: PROSPECTUS_DATA_NOT_AVAILABLE,
    direction: "unavailable",
    consistency: "unavailable",
    interpretation: "unavailable",
    accessibleLabel:
      "Trend unavailable because three valid years are not available",
    candidateInterpretationClass:
      PROSPECTUS_PAGE_THREE_TREND_CANDIDATE_INTERPRETATION_CLASS[metricKey],
    approved: false,
  };
}

function buildCoverageTrend(
  metricKey: ProspectusPageThreeCoverageEfficiencyRowKey,
  metricLabel: string,
  input: ProspectusPageThreeTrendsInput
): ProspectusPageThreeTrendItem {
  const years = input.financialSource.years;
  if (years.length !== 3) {
    return unavailableTrend(metricKey, metricLabel);
  }

  const values = years.map((year) =>
    numericValueForCoverageRow(metricKey, year.rawFinancials, year, {
      prospectusFinancialInputs: input.prospectusFinancialInputs,
      page2FinancialOverrides: input.page2FinancialOverrides,
    })
  );

  const result = computeProspectusTrendDirection({
    values,
    meaning: PROSPECTUS_COVERAGE_TREND_MEANING[metricKey],
  });

  return {
    metricKey,
    metricLabel,
    trend: result.approved ? result.direction : PROSPECTUS_DATA_NOT_AVAILABLE,
    direction: result.direction,
    consistency: result.consistency,
    interpretation: result.interpretation,
    accessibleLabel: result.accessibleLabel,
    candidateInterpretationClass:
      PROSPECTUS_PAGE_THREE_TREND_CANDIDATE_INTERPRETATION_CLASS[metricKey],
    approved: result.approved,
  };
}

/**
 * Builds trend slots for Page 3.
 * Coverage metrics use the same numeric sources as table cells (not reverse-parsed).
 * Income/balance metrics remain unavailable (no Trend column on those tables).
 */
export function buildProspectusPageThreeTrends(
  input: ProspectusPageThreeTrendsInput
): ProspectusPageThreeTrends {
  void input.ctosFinancials;
  void input.incomeStatement.years;
  void input.balanceSheet.years;
  void input.coverageEfficiency.years;

  const trends: ProspectusPageThreeTrendItem[] = PROSPECTUS_PAGE_THREE_TREND_METRIC_KEYS.map(
    (metricKey) => {
      const metricLabel = metricLabelFromSections(metricKey, input);
      if (!isCoverageTrendKey(metricKey)) {
        return unavailableTrend(metricKey, metricLabel);
      }
      return buildCoverageTrend(metricKey, metricLabel, input);
    }
  );

  return {
    sectionHeading: PROSPECTUS_PAGE_THREE_TRENDS_SECTION_HEADING,
    trends,
    audit: PROSPECTUS_PAGE_THREE_TRENDS_AUDIT,
  };
}
