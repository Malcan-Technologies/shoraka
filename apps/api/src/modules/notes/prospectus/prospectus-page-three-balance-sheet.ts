/**
 * SECTION: Build Page 3 Stage 4 balance sheet rows
 * WHY: Direct CTOS fields only for totals/current ratio; officer fills for Cash/Equity/Quick
 */

import {
  resolveCtosCurrentRatio,
  resolveCtosTotalAssets,
  resolveCtosTotalLiabilities,
} from "@cashsouk/types";
import {
  formatProspectusFinancialMultiple,
  formatProspectusMyrMillions,
  parseProspectusFinancialNumber,
} from "./prospectus-financial-comparison-metrics";
import { yearManualInputs } from "./prospectus-financial-manual-inputs";
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
  year: number,
  input: ProspectusPageThreeBalanceSheetInput,
  isPlaceholder: boolean
): string {
  if (isPlaceholder) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const manual = yearManualInputs(input.prospectusFinancialInputs?.years, year);

  switch (key) {
    case "cash_and_bank":
      return moneyMillionsOrDna(manual?.cashAndBank);
    case "trade_receivables":
      return moneyMillionsOrDna(manual?.tradeReceivables);
    case "total_equity":
      return moneyMillionsOrDna(manual?.totalEquity);
    case "quick_ratio": {
      const parsed = parseProspectusFinancialNumber(manual?.quickRatio);
      if (parsed == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
      return formatProspectusFinancialMultiple(parsed);
    }
    case "current_assets":
      return moneyMillionsOrDna(fieldFromRaw(raw, "bscatot"));
    case "total_assets":
      // CTOS ENQWS v5.11.0 — direct r:totass only (no component sum).
      return moneyMillionsOrDna(resolveCtosTotalAssets({ totass: fieldFromRaw(raw, "totass") }));
    case "current_liabilities":
      return moneyMillionsOrDna(fieldFromRaw(raw, "curlib"));
    case "total_liabilities":
      // CTOS ENQWS v5.11.0 — direct r:totlib only (no component sum).
      return moneyMillionsOrDna(
        resolveCtosTotalLiabilities({ totlib: fieldFromRaw(raw, "totlib") })
      );
    case "current_ratio": {
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — direct r:currat only.
      return formatProspectusFinancialMultiple(
        resolveCtosCurrentRatio({
          currat: fieldFromRaw(raw, "currat"),
        })
      );
    }
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
        valueForRow(key, year.rawFinancials, year.year, input, year.isPlaceholder === true)
      ),
    })),
    audit: PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT,
  };
}
