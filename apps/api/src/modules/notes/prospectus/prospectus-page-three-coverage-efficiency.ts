/**
 * SECTION: Build Page 3 Cash Flow, Coverage and Efficiency rows
 * WHY: Official CTOS fields/XSL for Debt/Equity, ROA, Asset Turnover; Page 2 reuse; officer OCF/FCF/Payables
 */

import {
  resolveCtosGearingRatio,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosReturnOnEquityPercent,
  resolveCtosTotalAssetTurnover,
  type CtosFinancialHighlightAccount,
} from "@cashsouk/types";
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

/** Account slice for official CTOS Financial Highlights resolvers. */
function highlightAccount(raw: Record<string, unknown>): CtosFinancialHighlightAccount {
  return {
    turnover: fieldFromRaw(raw, "turnover"),
    plnpat: fieldFromRaw(raw, "plnpat"),
    totass: fieldFromRaw(raw, "totass"),
    totlib: fieldFromRaw(raw, "totlib"),
    networth: fieldFromRaw(raw, "networth"),
    bscatot: fieldFromRaw(raw, "bscatot"),
    curlib: fieldFromRaw(raw, "curlib"),
    gear: fieldFromRaw(raw, "gear"),
    return_on_equity: fieldFromRaw(raw, "return_on_equity"),
    currat: fieldFromRaw(raw, "currat"),
  };
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
  const account = highlightAccount(raw);

  switch (key) {
    case "operating_cash_flow":
      return fieldFromRaw(raw, "operatingCashFlow");
    case "free_cash_flow":
      return fieldFromRaw(raw, "freeCashFlow");
    case "interest_coverage":
      return fieldFromRaw(raw, "interestCoverage");
    case "dscr":
      return fieldFromRaw(raw, "dscr");
    case "debt_equity":
      // Debt / Equity follows CTOS gearing (gear first, else totlib/networth).
      return resolveCtosGearingRatio(account);
    case "return_on_assets":
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — plnpat/totass*100 (percent points).
      return resolveCtosReturnOnAssetsPercent(account);
    case "receivables_days":
      return fieldFromRaw(raw, "receivablesDays");
    case "payables_days":
      return fieldFromRaw(raw, "payablesDays");
    case "asset_turnover":
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — turnover/totass (x).
      return resolveCtosTotalAssetTurnover(account);
    case "return_on_equity":
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — direct r:return_on_equity only.
      return resolveCtosReturnOnEquityPercent(account);
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
  const account = highlightAccount(raw);

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
            interestCoverage: fieldFromRaw(raw, "interestCoverage"),
          },
        } as any,
        "interestCoverage"
      );
    case "dscr":
      return page2MultipleOrDna(
        year,
        {
          [year.financialYearEndIso]: {
            dscr: fieldFromRaw(raw, "dscr"),
          },
        } as any,
        "dscr"
      );
    case "debt_equity":
      return formatProspectusFinancialMultiple(
        resolveCtosGearingRatio(account)
      );
    case "return_on_assets":
      return formatProspectusFinancialPercentFromPoints(
        resolveCtosReturnOnAssetsPercent(account)
      );
    case "receivables_days":
      return page2ReceivablesDaysOrDna(
        year,
        {
          [year.financialYearEndIso]: {
            receivablesDays: fieldFromRaw(raw, "receivablesDays"),
          },
        } as any
      );
    case "payables_days":
      return formatProspectusFinancialDays(fieldFromRaw(raw, "payablesDays"));
    case "asset_turnover":
      return formatProspectusFinancialMultiple(resolveCtosTotalAssetTurnover(account));
    case "return_on_equity": {
      return formatProspectusFinancialPercentFromPoints(
        resolveCtosReturnOnEquityPercent(account)
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
