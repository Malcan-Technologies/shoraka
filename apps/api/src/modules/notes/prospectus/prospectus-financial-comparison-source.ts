/**
 * SECTION: Page 2 financial comparison source (Stage 4A) from a Financial Review result
 * WHY: Financial Review resolves and calculates; the Prospectus only displays the selected years
 * (max 3, oldest→newest) with their stored raw and calculated values
 */

import {
  FINANCIAL_REVIEW_CALCULATED_KEYS,
  formatFinancialYearEndDisplayLabel,
  type FinancialReviewCalculatedValues,
  type FinancialReviewResolvedYear,
  type FinancialReviewResult,
} from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS,
  PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
  PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
  type ProspectusFinancialComparisonSource,
  type ProspectusFinancialComparisonStatementType,
  type ProspectusFinancialComparisonYear,
} from "./prospectus-financial-comparison-source.types";

export function formatProspectusFinancialYearLabel(year: number): string {
  return `FY${year}`;
}

export function formatProspectusFinancialYearEndLabel(
  financialYearEndIso: string | null | undefined
): string {
  if (!financialYearEndIso) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const label = formatFinancialYearEndDisplayLabel(financialYearEndIso);
  return label || PROSPECTUS_DATA_NOT_AVAILABLE;
}

/**
 * @deprecated Year selection belongs to the Financial Review result (`selected`).
 * Kept for tests that assert ascending display of year numbers.
 */
export function selectProspectusFinancialComparisonYears(yearKeys: Iterable<string>): number[] {
  const valid = new Set<number>();
  for (const key of yearKeys) {
    if (!/^\d{4}$/.test(key)) continue;
    const year = Number(key);
    if (Number.isInteger(year) && year >= 1000 && year <= 9999) valid.add(year);
  }
  const descending = [...valid].sort((a, b) => b - a);
  return descending
    .slice(0, PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS)
    .sort((a, b) => a - b);
}

/** All-null calculated values: display placeholders and years that never carried metrics. */
export function emptyProspectusCalculatedValues(): FinancialReviewCalculatedValues {
  const out = {} as FinancialReviewCalculatedValues;
  for (const key of FINANCIAL_REVIEW_CALCULATED_KEYS) out[key] = null;
  return out;
}

/** Old freezes and results without a statement type derive it from the record source. */
export function statementTypeFromRecordSource(
  recordSource: ProspectusFinancialComparisonYear["recordSource"] | null
): ProspectusFinancialComparisonStatementType {
  return recordSource === "ctos_audited" ? "AUDITED" : "MANAGEMENT_ACCOUNTS";
}

function sourceYearFromResultYear(
  year: FinancialReviewResolvedYear
): ProspectusFinancialComparisonYear {
  const financialYearEndIso = year.financial_year_end_iso ?? "";
  return {
    year: year.year,
    yearLabel: formatProspectusFinancialYearLabel(year.year),
    financialYearEndIso,
    financialYearEndLabel: formatProspectusFinancialYearEndLabel(financialYearEndIso),
    recordSource: year.record_source,
    statementType: year.statement_type ?? statementTypeFromRecordSource(year.record_source),
    rawFinancials: { ...year.effective_raw_values },
    calculatedValues: { ...year.calculated_values },
  };
}

/** Stage 4A source from a Financial Review result: the selected years, in ascending order. No resolving, no calculating. */
export function buildProspectusFinancialComparisonSourceFromResult(
  result: FinancialReviewResult
): ProspectusFinancialComparisonSource {
  const years = result.years
    .filter((year) => year.selected)
    .sort((a, b) => a.year - b.year)
    .map(sourceYearFromResultYear);

  return {
    sectionHeading: PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
    tableUnitLabel: PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
    sourceFooter: result.source_footer,
    years,
    // Admin Input fallbacks are added in Financial Review, never from the Prospectus.
    adminFallbackEligibleYears: [],
    missingSsmUnauditedYears: [...result.missing_ssm_unaudited_years],
    opsWarning: result.ops_warning,
    audit: PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  };
}
