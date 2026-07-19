/**
 * SECTION: Build Page 2 financial comparison source / year selection (Stage 4A)
 * WHY: Application unaudited years only; no CTOS; no metric formulas; no million conversion
 */

import { fyEndDateForYear, type FinancialStatementsQuestionnaire } from "@cashsouk/types";
import { format } from "date-fns";
import { parseApplicationFinancialStatements } from "./prospectus-json-guards";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS,
  PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
  PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  type ProspectusFinancialComparisonSource,
  type ProspectusFinancialComparisonSourceInput,
  type ProspectusFinancialComparisonYear,
} from "./prospectus-financial-comparison-source.types";

const VALID_YEAR_KEY = /^\d{4}$/;

export function isProspectusFinancialYearKey(key: string): boolean {
  if (!VALID_YEAR_KEY.test(key)) return false;
  const year = Number(key);
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

export function formatProspectusFinancialYearLabel(year: number): string {
  return `FY${year}`;
}

/**
 * Latest three valid 4-digit year keys, descending selection then ascending display order.
 */
export function selectProspectusFinancialComparisonYears(
  yearKeys: Iterable<string>
): number[] {
  const valid = new Set<number>();
  for (const key of yearKeys) {
    if (!isProspectusFinancialYearKey(key)) continue;
    valid.add(Number(key));
  }
  const descending = [...valid].sort((a, b) => b - a);
  const latest = descending.slice(0, PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS);
  return latest.sort((a, b) => a - b);
}

export function formatProspectusFinancialYearEndLabel(
  financialYearEndIso: string | null | undefined,
  year: number
): string {
  if (!financialYearEndIso) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const questionnaire: FinancialStatementsQuestionnaire = {
    financial_year_end: financialYearEndIso,
  };
  const end = fyEndDateForYear(questionnaire, year);
  if (!end) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return format(end, "d MMM yyyy");
}

export function buildProspectusFinancialComparisonSource(
  input: ProspectusFinancialComparisonSourceInput
): ProspectusFinancialComparisonSource {
  // Observational CTOS must never fill Application gaps.
  void input.ctosFinancials;

  const parsed = parseApplicationFinancialStatements(input.financialStatements);
  const selectedYears = selectProspectusFinancialComparisonYears(
    Object.keys(parsed.unauditedByYear)
  );

  const years: ProspectusFinancialComparisonYear[] = selectedYears.map((year) => {
    const key = String(year);
    const raw = parsed.unauditedByYear[key] ?? {};
    return {
      year,
      yearLabel: formatProspectusFinancialYearLabel(year),
      financialYearEndLabel: formatProspectusFinancialYearEndLabel(
        parsed.financialYearEndIso,
        year
      ),
      rawFinancials: { ...raw },
    };
  });

  return {
    sectionHeading: PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
    tableUnitLabel: PROSPECTUS_DATA_NOT_AVAILABLE,
    years,
    sourceNote: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  };
}
