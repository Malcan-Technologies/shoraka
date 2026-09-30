/**
 * SECTION: Build Page 3 Stage 3 income statement rows
 * WHY: Reuse Page 2 years + MYR-millions display formatter; EBIT and margin are stored
 * Financial Review values (never recalculated here)
 */

import type { FinancialReviewCalculatedValues } from "@cashsouk/types";
import {
  formatProspectusFinancialPercentFromPoints,
  formatProspectusMyrMillions,
  parseProspectusFinancialNumber,
} from "./prospectus-financial-comparison-metrics";
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

/** Display-only: full MYR storage → shared Page 2 millions formatter. */
function moneyMillionsOrDna(value: number | string | null | undefined): string {
  const parsed = parseProspectusFinancialNumber(value);
  if (parsed == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return formatProspectusMyrMillions(parsed);
}

function valueForRow(
  key: ProspectusPageThreeIncomeStatementRowKey,
  raw: Record<string, unknown>,
  calculated: FinancialReviewCalculatedValues,
  _year: number,
  _input: ProspectusPageThreeIncomeStatementInput,
  isPlaceholder: boolean
): string {
  if (isPlaceholder) return PROSPECTUS_DATA_NOT_AVAILABLE;

  switch (key) {
    case "revenue":
      return moneyMillionsOrDna(fieldFromRaw(raw, "turnover"));
    case "gross_profit":
      return moneyMillionsOrDna(fieldFromRaw(raw, "grossProfit"));
    case "ebitda":
      return moneyMillionsOrDna(fieldFromRaw(raw, "ebitda"));
    case "ebit":
      return moneyMillionsOrDna(calculated.ebit);
    case "profit_before_tax":
      return moneyMillionsOrDna(fieldFromRaw(raw, "plnpbt"));
    case "profit_after_tax":
      return moneyMillionsOrDna(fieldFromRaw(raw, "plnpat"));
    case "net_profit_margin":
      // Stored PAT Margin (percent points) — never profit_margin (CTOS raw PBT margin).
      return formatProspectusFinancialPercentFromPoints(calculated.profit_margin);
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
      isPlaceholder: year.isPlaceholder === true,
    })),
    rows: PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS.map((key) => ({
      key,
      label: PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_LABELS[key],
      values: years.map((year) =>
        valueForRow(
          key,
          year.rawFinancials,
          year.calculatedValues,
          year.year,
          input,
          year.isPlaceholder === true
        )
      ),
    })),
    audit: PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT,
  };
}
