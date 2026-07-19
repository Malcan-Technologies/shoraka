/**
 * SECTION: Build Page 3 Stage 4 cash flow / coverage / efficiency rows
 * WHY: ROE via shared helper matching Page 2; all other Canva rows stay DNA; no trends
 */

import { calculateReturnOnEquity } from "@cashsouk/types";
import {
  formatProspectusFinancialPercentFromRatio,
  parseProspectusFinancialNumber,
} from "./prospectus-financial-comparison-metrics";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
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

function valueForRow(
  key: ProspectusPageThreeCoverageEfficiencyRowKey,
  raw: Record<string, unknown>
): string {
  switch (key) {
    case "operating_cash_flow":
    case "free_cash_flow":
    case "interest_coverage":
    case "dscr":
    case "debt_equity":
    case "return_on_assets":
    case "receivables_days":
    case "payables_days":
    case "asset_turnover":
      return PROSPECTUS_DATA_NOT_AVAILABLE;
    case "return_on_equity": {
      const plnpat = fieldFromRaw(raw, "plnpat");
      const bsqpuc = fieldFromRaw(raw, "bsqpuc");
      if (plnpat == null || bsqpuc == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
      return formatProspectusFinancialPercentFromRatio(
        calculateReturnOnEquity(plnpat, bsqpuc)
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
      values: years.map((year) => valueForRow(key, year.rawFinancials)),
    })),
    audit: PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT,
  };
}
