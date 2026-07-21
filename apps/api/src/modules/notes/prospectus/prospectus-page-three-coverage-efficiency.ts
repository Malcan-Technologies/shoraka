/**
 * SECTION: Build Page 3 Cash Flow, Coverage and Efficiency rows
 * WHY: ROE from Application resolver; IC/DSCR/Receivables from Page 2; six officer fills
 */

import { resolveApplicationFinancialReturnOnEquityRatio } from "@cashsouk/types";
import {
  formatProspectusFinancialDays,
  formatProspectusFinancialMultiple,
  formatProspectusFinancialPercentFromPoints,
  formatProspectusFinancialPercentFromRatio,
  formatProspectusMyrMillions,
  parseProspectusFinancialNumber,
  resolveYearOverride,
} from "./prospectus-financial-comparison-metrics";
import type { ProspectusFinancialComparisonYearOfficerOverride } from "./prospectus-financial-comparison-metrics.types";
import type { ProspectusFinancialComparisonYear } from "./prospectus-financial-comparison-source.types";
import { yearManualInputs } from "./prospectus-financial-manual-inputs";
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
  if (!Number.isInteger(n)) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return formatProspectusFinancialDays(n);
}

function moneyMillionsOrDna(value: number | string | null | undefined): string {
  const parsed = parseProspectusFinancialNumber(value);
  if (parsed == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return formatProspectusMyrMillions(parsed);
}

function valueForRow(
  key: ProspectusPageThreeCoverageEfficiencyRowKey,
  raw: Record<string, unknown>,
  year: ProspectusFinancialComparisonYear,
  input: ProspectusPageThreeCoverageEfficiencyInput
): string {
  const manual = yearManualInputs(input.prospectusFinancialInputs?.years, year.year);

  switch (key) {
    case "operating_cash_flow":
      return moneyMillionsOrDna(manual?.operatingCashFlow);
    case "free_cash_flow":
      return moneyMillionsOrDna(manual?.freeCashFlow);
    case "interest_coverage":
      return page2MultipleOrDna(year, input.page2FinancialOverrides, "interestCoverage");
    case "dscr":
      return page2MultipleOrDna(year, input.page2FinancialOverrides, "dscr");
    case "debt_equity":
      return formatProspectusFinancialMultiple(
        parseProspectusFinancialNumber(manual?.debtEquity)
      );
    case "return_on_assets":
      return formatProspectusFinancialPercentFromPoints(
        parseProspectusFinancialNumber(manual?.returnOnAssets)
      );
    case "receivables_days":
      return page2ReceivablesDaysOrDna(year, input.page2FinancialOverrides);
    case "payables_days":
      return formatProspectusFinancialDays(
        parseProspectusFinancialNumber(manual?.payablesDays)
      );
    case "asset_turnover":
      return formatProspectusFinancialMultiple(
        parseProspectusFinancialNumber(manual?.assetTurnover)
      );
    case "return_on_equity": {
      return formatProspectusFinancialPercentFromRatio(
        resolveApplicationFinancialReturnOnEquityRatio({
          return_on_equity: fieldFromRaw(raw, "return_on_equity"),
          plnpat: fieldFromRaw(raw, "plnpat"),
          bsqpuc: fieldFromRaw(raw, "bsqpuc"),
        })
      );
    }
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
    })),
    rows: PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS.map((key) => ({
      key,
      label: PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_LABELS[key],
      values: years.map((year) => valueForRow(key, year.rawFinancials, year, input)),
    })),
    audit: PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT,
  };
}
