/**
 * SECTION: Build Page 3 Stage 4 balance sheet rows
 * WHY: Raw rows from reviewed raw values; totals, equity and ratios are stored Financial Review
 * values (never recalculated here)
 */

import type { FinancialReviewCalculatedValues } from "@cashsouk/types";
import {
  formatProspectusFinancialMultiple,
  formatProspectusMyrMillions,
  parseProspectusFinancialNumber,
} from "./prospectus-financial-comparison-metrics";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT,
  PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS,
  PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_LABELS,
  PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SECTION_HEADING,
  type ProspectusPageThreeBalanceSheet,
  type ProspectusPageThreeBalanceSheetInput,
  type ProspectusPageThreeBalanceSheetRowKey,
} from "./prospectus-page-three-balance-sheet.types";

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
  key: ProspectusPageThreeBalanceSheetRowKey,
  raw: Record<string, unknown>,
  calculated: FinancialReviewCalculatedValues,
  _year: number,
  _input: ProspectusPageThreeBalanceSheetInput,
  isPlaceholder: boolean
): string {
  if (isPlaceholder) return PROSPECTUS_DATA_NOT_AVAILABLE;

  switch (key) {
    case "cash_and_bank":
      return moneyMillionsOrDna(fieldFromRaw(raw, "cashAndBank"));
    case "trade_receivables":
      return moneyMillionsOrDna(fieldFromRaw(raw, "tradeReceivables"));
    case "total_equity":
      return moneyMillionsOrDna(calculated.networth);
    case "quick_ratio":
      return formatProspectusFinancialMultiple(calculated.quickRatio);
    case "current_assets":
      return moneyMillionsOrDna(fieldFromRaw(raw, "bscatot"));
    case "total_assets":
      return moneyMillionsOrDna(calculated.totass);
    case "current_liabilities":
      return moneyMillionsOrDna(fieldFromRaw(raw, "curlib"));
    case "total_liabilities":
      return moneyMillionsOrDna(calculated.totlib);
    case "current_ratio":
      return formatProspectusFinancialMultiple(calculated.currat);
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function buildProspectusPageThreeBalanceSheet(
  input: ProspectusPageThreeBalanceSheetInput
): ProspectusPageThreeBalanceSheet {
  void input.ctosFinancials;

  const { years } = input.financialSource;

  return {
    sectionHeading: PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SECTION_HEADING,
    years: years.map((year) => ({
      year: year.year,
      yearLabel: year.yearLabel,
      financialYearEndLabel: year.financialYearEndLabel,
      isPlaceholder: year.isPlaceholder === true,
    })),
    rows: PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS.map((key) => ({
      key,
      label: PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_LABELS[key],
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
    audit: PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT,
  };
}
