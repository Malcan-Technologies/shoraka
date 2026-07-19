/**
 * SECTION: Build Page 3 Stage 3 balance sheet and liquidity rows
 * WHY: Reuse Page 2 years; admin computeTotalAssets/Liabilities; unsupported rows DNA
 */

import {
  calculateCurrentRatio,
  computeTotalAssets,
  computeTotalLiabilities,
} from "@cashsouk/types";
import {
  formatProspectusFinancialMultiple,
  parseProspectusFinancialNumber,
} from "./prospectus-financial-comparison-metrics";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
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

/**
 * Application FS never stores totass — same as admin financialFormToBsPl(total_assets: null).
 * Nullish components follow computeTotalAssets (?? 0).
 */
function totalAssetsFromRaw(raw: Record<string, unknown>): number {
  return computeTotalAssets({
    total_assets: null,
    fixed_assets: fieldFromRaw(raw, "bsfatot"),
    other_assets: fieldFromRaw(raw, "othass"),
    current_assets: fieldFromRaw(raw, "bscatot"),
    non_current_assets: fieldFromRaw(raw, "bsclbank"),
  });
}

/**
 * Application FS never stores totlib — same as admin financialFormToBsPl(total_liabilities: null).
 * Nullish components follow computeTotalLiabilities (?? 0).
 */
function totalLiabilitiesFromRaw(raw: Record<string, unknown>): number {
  return computeTotalLiabilities({
    total_liabilities: null,
    current_liabilities: fieldFromRaw(raw, "curlib"),
    long_term_liabilities: fieldFromRaw(raw, "bsslltd"),
    non_current_liabilities: fieldFromRaw(raw, "bsclstd"),
  });
}

function valueForRow(
  key: ProspectusPageThreeBalanceSheetRowKey,
  raw: Record<string, unknown>
): string {
  switch (key) {
    case "cash_and_bank":
    case "trade_receivables":
    case "total_equity":
    case "quick_ratio":
      return PROSPECTUS_DATA_NOT_AVAILABLE;
    case "current_assets":
      return formatProspectusMoneyMyr(fieldFromRaw(raw, "bscatot"));
    case "total_assets":
      return formatProspectusMoneyMyr(totalAssetsFromRaw(raw));
    case "current_liabilities":
      return formatProspectusMoneyMyr(fieldFromRaw(raw, "curlib"));
    case "total_liabilities":
      return formatProspectusMoneyMyr(totalLiabilitiesFromRaw(raw));
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
      values: years.map((year) => valueForRow(key, year.rawFinancials)),
    })),
    audit: PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT,
  };
}
