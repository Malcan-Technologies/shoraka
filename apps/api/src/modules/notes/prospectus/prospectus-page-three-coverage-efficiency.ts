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
  formatManualMoneyOrDna,
  formatManualRatioOrDna,
  yearManualInputs,
} from "./prospectus-financial-manual-inputs";
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
  raw: Record<string, unknown>,
  year: number,
  input: ProspectusPageThreeCoverageEfficiencyInput
): string {
  const manual = yearManualInputs(input.prospectusFinancialInputs?.years, year);

  switch (key) {
    case "operating_cash_flow":
      return formatManualMoneyOrDna(manual?.operatingCashFlow);
    case "free_cash_flow":
      return formatManualMoneyOrDna(manual?.freeCashFlow);
    case "interest_coverage":
      return formatManualRatioOrDna(manual?.interestCoverage);
    case "dscr":
      return formatManualRatioOrDna(manual?.dscr);
    case "debt_equity":
      return formatManualRatioOrDna(manual?.debtEquity);
    case "return_on_assets":
      return formatManualRatioOrDna(manual?.returnOnAssets);
    case "receivables_days":
      return formatManualRatioOrDna(manual?.receivablesDays);
    case "payables_days":
      return formatManualRatioOrDna(manual?.payablesDays);
    case "asset_turnover":
      return formatManualRatioOrDna(manual?.assetTurnover);
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
      values: years.map((year) =>
        valueForRow(key, year.rawFinancials, year.year, input)
      ),
    })),
    audit: PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT,
  };
}
