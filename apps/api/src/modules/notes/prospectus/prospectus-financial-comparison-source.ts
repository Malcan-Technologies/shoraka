/**
 * SECTION: Build Page 2 financial comparison source / year selection (Stage 4A)
 * WHY: Align with Admin Financial Statements year set; max 3; oldest→newest
 */

import {
  buildNormalizedFinancialStatementYearSet,
  formatFinancialYearEndDisplayLabel,
  resolveFinancialStatementSourceFooter,
  selectLatestNormalizedFinancialStatementYears,
} from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS,
  PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
  PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
  type ProspectusFinancialComparisonSource,
  type ProspectusFinancialComparisonSourceInput,
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
 * @deprecated Prefer shared `selectLatestNormalizedFinancialStatementYears`.
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

export function isProspectusFinancialYearKey(key: string): boolean {
  if (!/^\d{4}$/.test(key)) return false;
  const year = Number(key);
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

export function buildProspectusFinancialComparisonSource(
  input: ProspectusFinancialComparisonSourceInput
): ProspectusFinancialComparisonSource {
  const available = buildNormalizedFinancialStatementYearSet({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: input.ref,
  });
  const selected = selectLatestNormalizedFinancialStatementYears(
    available,
    PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS
  );

  const years: ProspectusFinancialComparisonYear[] = selected.map((year) => ({
    year: year.year,
    yearLabel: formatProspectusFinancialYearLabel(year.year),
    financialYearEndIso: year.financialYearEndIso,
    financialYearEndLabel: formatProspectusFinancialYearEndLabel(year.financialYearEndIso),
    recordSource: year.recordSource,
    rawFinancials: { ...year.rawFinancials },
  }));

  return {
    sectionHeading: PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
    tableUnitLabel: PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
    sourceFooter: resolveFinancialStatementSourceFooter(years),
    years,
    audit: PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  };
}
