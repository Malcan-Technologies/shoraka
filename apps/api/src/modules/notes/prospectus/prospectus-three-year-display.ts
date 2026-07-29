/**
 * SECTION: Prospectus-only three-year display padding
 * WHY: Always show Y-2 | Y-1 | Y columns without inventing stored financial records
 */

import {
  formatProspectusFinancialYearEndLabel,
  formatProspectusFinancialYearLabel,
} from "./prospectus-financial-comparison-source";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS,
  type ProspectusFinancialComparisonSource,
  type ProspectusFinancialComparisonYear,
} from "./prospectus-financial-comparison-source.types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Real selected years only — never includes display placeholders. */
export function selectRealProspectusFinancialYears(
  years: readonly ProspectusFinancialComparisonYear[]
): ProspectusFinancialComparisonYear[] {
  return years.filter((year) => !year.isPlaceholder);
}

/**
 * Derive a placeholder FYE ISO from the latest real year's month/day.
 * Returns null when the month/day is missing or invalid for the target year
 * (e.g. 29 Feb on a non-leap year).
 */
export function derivePlaceholderFinancialYearEndIso(
  year: number,
  anchorFinancialYearEndIso: string | null | undefined
): string | null {
  if (!anchorFinancialYearEndIso || !ISO_DATE.test(anchorFinancialYearEndIso.trim())) {
    return null;
  }
  const iso = anchorFinancialYearEndIso.trim();
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) {
    return null;
  }
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null;
  }
  return `${year}-${iso.slice(5, 7)}-${iso.slice(8, 10)}`;
}

function placeholderYear(
  year: number,
  anchorFinancialYearEndIso: string | null | undefined
): ProspectusFinancialComparisonYear {
  const financialYearEndIso = derivePlaceholderFinancialYearEndIso(
    year,
    anchorFinancialYearEndIso
  );
  return {
    year,
    yearLabel: formatProspectusFinancialYearLabel(year),
    financialYearEndIso: financialYearEndIso ?? "",
    financialYearEndLabel: financialYearEndIso
      ? formatProspectusFinancialYearEndLabel(financialYearEndIso)
      : PROSPECTUS_DATA_NOT_AVAILABLE,
    // Display-only slot — never treated as a real CTOS/unaudited record.
    recordSource: "unaudited_management",
    rawFinancials: {},
    isPlaceholder: true,
  };
}

/**
 * Prospectus display years: consecutive [Y-2, Y-1, Y] anchored on the latest real year.
 * Maps real records into matching columns; missing years become presentation placeholders.
 *
 * Zero real years → empty (do not invent a calendar-year anchor).
 */
export function buildProspectusThreeYearDisplaySet(
  realYears: readonly ProspectusFinancialComparisonYear[]
): ProspectusFinancialComparisonYear[] {
  const real = selectRealProspectusFinancialYears(realYears);
  if (real.length === 0) return [];

  const byYear = new Map(real.map((year) => [year.year, year]));
  const latestYear = Math.max(...real.map((year) => year.year));
  const anchor = byYear.get(latestYear) ?? real[real.length - 1];
  const anchorFye = anchor?.financialYearEndIso ?? null;

  const startYear = latestYear - (PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS - 1);
  const display: ProspectusFinancialComparisonYear[] = [];
  for (let year = startYear; year <= latestYear; year += 1) {
    const existing = byYear.get(year);
    if (existing) {
      display.push({ ...existing, isPlaceholder: false });
      continue;
    }
    display.push(placeholderYear(year, anchorFye));
  }
  return display;
}

/** Apply display padding to a Stage 4A source. Does not alter ops warnings or freeze data. */
export function withProspectusThreeYearDisplay(
  source: ProspectusFinancialComparisonSource
): ProspectusFinancialComparisonSource {
  return {
    ...source,
    years: buildProspectusThreeYearDisplaySet(source.years),
  };
}
