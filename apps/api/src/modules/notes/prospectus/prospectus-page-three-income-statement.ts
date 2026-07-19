/**
 * SECTION: Build Page 3 Stage 2 income statement rows
 * WHY: Reuse Page 2 years + parsers/formatters; unsupported Canva rows stay DNA
 */

import { calculateProfitMargin } from "@cashsouk/types";
import {
  formatProspectusFinancialPercentFromRatio,
  parseProspectusFinancialNumber,
} from "./prospectus-financial-comparison-metrics";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT,
  PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS,
  PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_LABELS,
  PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SECTION_HEADING,
  type ProspectusPageThreeIncomeStatement,
  type ProspectusPageThreeIncomeStatementInput,
  type ProspectusPageThreeIncomeStatementRowKey,
} from "./prospectus-page-three-income-statement.types";

function fieldFromRaw(raw: Record<string, unknown>, key: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(raw, key)) return null;
  return parseProspectusFinancialNumber(raw[key]);
}

function valueForRow(
  key: ProspectusPageThreeIncomeStatementRowKey,
  raw: Record<string, unknown>
): string {
  switch (key) {
    case "revenue":
      return formatProspectusMoneyMyr(fieldFromRaw(raw, "turnover"));
    case "gross_profit":
    case "ebitda":
    case "ebit":
      return PROSPECTUS_DATA_NOT_AVAILABLE;
    case "profit_before_tax":
      return formatProspectusMoneyMyr(fieldFromRaw(raw, "plnpbt"));
    case "profit_after_tax":
      return formatProspectusMoneyMyr(fieldFromRaw(raw, "plnpat"));
    case "net_profit_margin": {
      const plnpat = fieldFromRaw(raw, "plnpat");
      const turnover = fieldFromRaw(raw, "turnover");
      if (plnpat == null || turnover == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
      return formatProspectusFinancialPercentFromRatio(
        calculateProfitMargin(plnpat, turnover)
      );
    }
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function buildProspectusPageThreeIncomeStatement(
  input: ProspectusPageThreeIncomeStatementInput
): ProspectusPageThreeIncomeStatement {
  void input.ctosFinancials;

  const { years } = input.financialSource;

  return {
    sectionHeading: PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SECTION_HEADING,
    years: years.map((year) => ({
      year: year.year,
      yearLabel: year.yearLabel,
      financialYearEndLabel: year.financialYearEndLabel,
    })),
    rows: PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS.map((key) => ({
      key,
      label: PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_LABELS[key],
      values: years.map((year) => valueForRow(key, year.rawFinancials)),
    })),
    audit: PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT,
  };
}
