/**
 * SECTION: Build Page 3 Stage 3 balance sheet and liquidity rows
 * WHY: Reuse Page 2 years; Application-aligned totals; MYR-millions display
 */

import {
  calculateCurrentRatio,
  resolveApplicationFinancialTotalAssets,
  resolveApplicationFinancialTotalLiabilities,
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

/** Display-only: full MYR storage → shared Page 2/3 millions formatter. */
function moneyMillionsOrDna(value: number | string | null | undefined): string {
  const parsed = parseProspectusFinancialNumber(value);
  if (parsed == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return formatProspectusMyrMillions(parsed);
}

/**
 * Same resolution as Application Financial Summary:
 * prefer flat totass when present; else computeTotalAssets with zero-default components.
 */
function totalAssetsFromRaw(raw: Record<string, unknown>): number {
  return resolveApplicationFinancialTotalAssets({
    totass: fieldFromRaw(raw, "totass"),
    bsfatot: fieldFromRaw(raw, "bsfatot"),
    othass: fieldFromRaw(raw, "othass"),
    bscatot: fieldFromRaw(raw, "bscatot"),
    bsclbank: fieldFromRaw(raw, "bsclbank"),
  });
}

/**
 * Same resolution as Application Financial Summary:
 * prefer flat totlib when present; else computeTotalLiabilities with zero-default components.
 */
function totalLiabilitiesFromRaw(raw: Record<string, unknown>): number {
  return resolveApplicationFinancialTotalLiabilities({
    totlib: fieldFromRaw(raw, "totlib"),
    curlib: fieldFromRaw(raw, "curlib"),
    bsslltd: fieldFromRaw(raw, "bsslltd"),
    bsclstd: fieldFromRaw(raw, "bsclstd"),
  });
}

function valueForRow(
  key: ProspectusPageThreeBalanceSheetRowKey,
  raw: Record<string, unknown>,
  year: number,
  input: ProspectusPageThreeBalanceSheetInput
): string {
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
      return formatProspectusMyrMillions(totalAssetsFromRaw(raw));
    case "current_liabilities":
      return moneyMillionsOrDna(fieldFromRaw(raw, "curlib"));
    case "total_liabilities":
      return formatProspectusMyrMillions(totalLiabilitiesFromRaw(raw));
    case "current_ratio": {
      const bscatot = fieldFromRaw(raw, "bscatot");
      const curlib = fieldFromRaw(raw, "curlib");
      if (bscatot == null || curlib == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
      return formatProspectusFinancialMultiple(calculateCurrentRatio(bscatot, curlib));
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
    })),
    rows: PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS.map((key) => ({
      key,
      label: PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_LABELS[key],
      values: years.map((year) =>
        valueForRow(key, year.rawFinancials, year.year, input)
      ),
    })),
    audit: PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT,
  };
}
