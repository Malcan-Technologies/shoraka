/**
 * SECTION: Build Page 3 Cash Flow, Coverage and Efficiency rows
 * WHY: Cash flow rows from reviewed raw values; coverage and efficiency metrics are stored
 * Financial Review values (never recalculated here); Page 2 formatting reuse
 */

import {
  formatProspectusFinancialDays,
  formatProspectusFinancialMultiple,
  formatProspectusFinancialPercentFromPoints,
  formatProspectusMyrMillions,
  parseProspectusFinancialNumber,
  resolveYearOverride,
} from "./prospectus-financial-comparison-metrics";
import type { ProspectusFinancialComparisonYearOfficerOverride } from "./prospectus-financial-comparison-metrics.types";
import type { ProspectusFinancialComparisonYear } from "./prospectus-financial-comparison-source.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import {
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT,
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS,
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_LABELS,
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SECTION_HEADING,
  type ProspectusPageThreeCoverageEfficiency,
  type ProspectusPageThreeCoverageEfficiencyInput,
  type ProspectusPageThreeCoverageEfficiencyRowKey,
} from "./prospectus-page-three-coverage-efficiency.types";

function fieldFromRaw(raw: Record<string, unknown>, key: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(raw, key)) return null;
  return parseProspectusFinancialNumber(raw[key]);
}

/** Same formatting as Page 2 Financial Comparison officer multiples. */
function page2MultipleOrDna(
  year: ProspectusFinancialComparisonYear,
  overrides: ProspectusPageThreeCoverageEfficiencyInput["page2FinancialOverrides"],
  field: "interestCoverage" | "dscr"
): string {
  const override = resolveYearOverride(
    year,
    overrides as Record<string, ProspectusFinancialComparisonYearOfficerOverride> | null | undefined
  );
  const n = parseProspectusFinancialNumber(override?.[field]);
  return formatProspectusFinancialMultiple(n);
}

/** Same formatting as Page 2 Receivables Days (whole number). */
function page2ReceivablesDaysOrDna(
  year: ProspectusFinancialComparisonYear,
  overrides: ProspectusPageThreeCoverageEfficiencyInput["page2FinancialOverrides"]
): string {
  const override = resolveYearOverride(
    year,
    overrides as Record<string, ProspectusFinancialComparisonYearOfficerOverride> | null | undefined
  );
  const n = parseProspectusFinancialNumber(override?.receivablesDays);
  if (n == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return formatProspectusFinancialDays(n);
}

function moneyMillionsOrDna(value: number | string | null | undefined): string {
  const parsed = parseProspectusFinancialNumber(value);
  if (parsed == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return formatProspectusMyrMillions(parsed);
}

/**
 * Numeric series for Trend (3-Yr) — same sources as displayed cells.
 * Never reverse-parses formatted display strings.
 */
export function numericValueForCoverageRow(
  key: ProspectusPageThreeCoverageEfficiencyRowKey,
  raw: Record<string, unknown>,
  year: ProspectusFinancialComparisonYear,
  _input: Pick<
    ProspectusPageThreeCoverageEfficiencyInput,
    "prospectusFinancialInputs" | "page2FinancialOverrides"
  >
): number | null {
  if (year.isPlaceholder) return null;
  const calculated = year.calculatedValues;

  switch (key) {
    case "operating_cash_flow":
      return fieldFromRaw(raw, "operatingCashFlow");
    case "free_cash_flow":
      return fieldFromRaw(raw, "freeCashFlow");
    case "interest_coverage":
      return calculated.interestCoverage;
    case "dscr":
      return calculated.dscr;
    case "debt_equity":
      return calculated.gear;
    case "return_on_assets":
      return calculated.roa;
    case "receivables_days":
      return calculated.receivablesDays;
    case "payables_days":
      return calculated.payablesDays;
    case "asset_turnover":
      return calculated.assetTurnover;
    case "return_on_equity":
      return calculated.return_on_equity;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

function valueForRow(
  key: ProspectusPageThreeCoverageEfficiencyRowKey,
  raw: Record<string, unknown>,
  year: ProspectusFinancialComparisonYear,
  _input: ProspectusPageThreeCoverageEfficiencyInput
): string {
  if (year.isPlaceholder) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const calculated = year.calculatedValues;

  switch (key) {
    case "operating_cash_flow":
      return moneyMillionsOrDna(fieldFromRaw(raw, "operatingCashFlow"));
    case "free_cash_flow":
      return moneyMillionsOrDna(fieldFromRaw(raw, "freeCashFlow"));
    case "interest_coverage":
      return page2MultipleOrDna(
        year,
        {
          [year.financialYearEndIso]: {
            interestCoverage: calculated.interestCoverage,
          },
        } as any,
        "interestCoverage"
      );
    case "dscr":
      return page2MultipleOrDna(
        year,
        {
          [year.financialYearEndIso]: {
            dscr: calculated.dscr,
          },
        } as any,
        "dscr"
      );
    case "debt_equity":
      return formatProspectusFinancialMultiple(calculated.gear);
    case "return_on_assets":
      return formatProspectusFinancialPercentFromPoints(calculated.roa);
    case "receivables_days":
      return page2ReceivablesDaysOrDna(
        year,
        {
          [year.financialYearEndIso]: {
            receivablesDays: calculated.receivablesDays,
          },
        } as any
      );
    case "payables_days":
      return formatProspectusFinancialDays(calculated.payablesDays);
    case "asset_turnover":
      return formatProspectusFinancialMultiple(calculated.assetTurnover);
    case "return_on_equity":
      return formatProspectusFinancialPercentFromPoints(calculated.return_on_equity);
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function buildProspectusPageThreeCoverageEfficiency(
  input: ProspectusPageThreeCoverageEfficiencyInput
): ProspectusPageThreeCoverageEfficiency {
  void input.ctosFinancials;

  const { years } = input.financialSource;

  return {
    sectionHeading: PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SECTION_HEADING,
    years: years.map((year) => ({
      year: year.year,
      yearLabel: year.yearLabel,
      financialYearEndLabel: year.financialYearEndLabel,
      isPlaceholder: year.isPlaceholder === true,
    })),
    rows: PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS.map((key) => ({
      key,
      label: PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_LABELS[key],
      values: years.map((year) => valueForRow(key, year.rawFinancials, year, input)),
    })),
    audit: PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT,
  };
}
