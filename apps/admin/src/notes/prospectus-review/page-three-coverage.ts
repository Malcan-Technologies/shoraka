import { formatCurrency } from "@cashsouk/config";
import {
  isMarcSmeGrade,
  normalizeProspectusCompanySize,
  type FinancialReviewCalculatedKey,
  type NoteDetail,
  type ProspectusFrozenFinancialRaw,
  type ProspectusFrozenFinancialYear,
} from "@cashsouk/types";
import type { CoreTermRow } from "./core-terms";
import type { FinancialMetricTableModel } from "./financial-metric-table";
import { PAGE_TWO_OFFICER_FINANCIAL_METRICS } from "./page-two-coverage";

export {
  calendarYearFromFinancialHeaderKey,
  selectYearsFromPageTwoFinancialTable,
} from "./financial-year-keys";

const DATA_NOT_AVAILABLE = "—";
const PAGE_THREE_TITLE = "DETAILED FINANCIAL COMPARISON";

/** Ten Stage 5 Trend (3-Yr) outcomes only — not the internal 26-item model. */
export const PAGE_THREE_RENDERED_TREND_METRICS = [
  "Operating Cash Flow",
  "Free Cash Flow",
  "Interest Coverage",
  "DSCR",
  "Debt / Equity",
  "Return on Equity",
  "Return on Assets",
  "Receivables Days",
  "Payables Days",
  "Asset Turnover",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textOrDna(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return DATA_NOT_AVAILABLE;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatMoney(value: number | null): string {
  if (value == null) return DATA_NOT_AVAILABLE;
  return formatCurrency(value);
}

/** Percentage points display (CTOS ROA / PAT Margin / ROE). */
function formatPercentFromPoints(points: number | null): string {
  if (points == null || !Number.isFinite(points)) return DATA_NOT_AVAILABLE;
  const fixed = points.toFixed(2).replace(/\.?0+$/, "");
  return `${fixed}%`;
}

function formatMultiple(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return DATA_NOT_AVAILABLE;
  const fixed = value.toFixed(2).replace(/\.?0+$/, "");
  return `${fixed}x`;
}

function formatDays(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return DATA_NOT_AVAILABLE;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

type Page2FinancialOverrides =
  | Record<
      string,
      Partial<
        Record<(typeof PAGE_TWO_OFFICER_FINANCIAL_METRICS)[number]["key"], string | number | null>
      >
    >
  | null
  | undefined;

function page2OverrideForYear(
  overrides: Page2FinancialOverrides,
  year: string
): Partial<Record<(typeof PAGE_TWO_OFFICER_FINANCIAL_METRICS)[number]["key"], string | number | null>> | undefined {
  if (!overrides) return undefined;
  return (
    overrides[year] ??
    overrides[`${year}-12-31`] ??
    Object.entries(overrides).find(([key]) => key.startsWith(`${year}-`))?.[1]
  );
}

/** Calendar years from frozen Stage 4A years (oldest → newest). */
export function selectPageThreeYears(frozenYears: ProspectusFrozenFinancialYear[]): string[] {
  return frozenYears.map((year) => String(year.calendarYear));
}

function yearHeadersFromFrozen(
  frozenYears: ProspectusFrozenFinancialYear[]
): FinancialMetricTableModel["yearHeaders"] {
  return frozenYears.map((year) => {
    const isPlaceholder = year.isPlaceholder === true;
    return {
    key: year.financialYearEndIso,
    yearLabel: year.label,
    fyeLabel: year.fyeLabel,
    isPlaceholder,
    adminFallbackEligible: year.adminFallbackEligible === true,
    sourceType: isPlaceholder ? undefined : year.sourceType,
    statementType: isPlaceholder ? undefined : year.statementType,
  };
  });
}

function rawAsRecord(raw: ProspectusFrozenFinancialRaw): Record<string, unknown> {
  return { ...raw };
}

/** Raw figures plus the metrics stored with the approved Financial result for one frozen year. */
export type PageThreeYearValues = Pick<ProspectusFrozenFinancialYear, "raw" | "calculated">;

/** Stored calculated metric (never recalculated here); missing → null. */
function calculatedValue(year: PageThreeYearValues, key: FinancialReviewCalculatedKey): number | null {
  const value = year.calculated?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildPageThreeOverviewRows(
  frozenYears: ProspectusFrozenFinancialYear[]
): CoreTermRow[] {
  const years = selectPageThreeYears(frozenYears);
  return [
    { label: "Page title", value: PAGE_THREE_TITLE },
    { label: "Subtitle", value: DATA_NOT_AVAILABLE },
    {
      label: "Financial years included",
      value: years.length > 0 ? years.map((y) => `FY${y}`).join(" · ") : DATA_NOT_AVAILABLE,
    },
  ];
}

/** Same Sector join rules as API `formatProspectusPageThreeSector`. */
export function formatPageThreeSectorDisplay(
  industry: unknown,
  companySize: unknown
): string {
  const industryText =
    typeof industry === "string" && industry.trim() ? industry.trim() : null;
  const sizeText = normalizeProspectusCompanySize(companySize);
  if (industryText && sizeText) return `${industryText} | ${sizeText}`;
  if (industryText) return industryText;
  if (sizeText) return sizeText;
  return DATA_NOT_AVAILABLE;
}

export function buildPageThreeMetadataRows(
  note: NoteDetail,
  officerFields?: {
    companySize?: string | null;
  }
): CoreTermRow[] {
  const issuer = asRecord(note.issuerSnapshot);
  const paymaster = asRecord(note.paymasterSnapshot);
  const invoice = asRecord(note.invoiceSnapshot);
  const offerDetails = asRecord(invoice?.offer_details);
  const riskRating = isMarcSmeGrade(offerDetails?.risk_rating)
    ? offerDetails.risk_rating
    : DATA_NOT_AVAILABLE;
  return [
    {
      label: "Sector",
      value: formatPageThreeSectorDisplay(
        issuer?.industry ?? note.issuerIndustry,
        officerFields?.companySize
      ),
    },
    { label: "Risk Rating", value: riskRating },
    { label: "Paymaster", value: textOrDna(note.paymasterName ?? paymaster?.name) },
  ];
}

/**
 * Admin working-area overview only — Industry and Company Size are separate fields.
 * Investor HTML continues to use formatPageThreeSectorDisplay / buildPageThreeMetadataRows.
 */
export function buildPageThreeAdminOverviewRows(
  note: NoteDetail,
  officerFields?: {
    companySize?: string | null;
  }
): CoreTermRow[] {
  const issuer = asRecord(note.issuerSnapshot);
  const paymaster = asRecord(note.paymasterSnapshot);
  const invoice = asRecord(note.invoiceSnapshot);
  const offerDetails = asRecord(invoice?.offer_details);
  const industry =
    typeof issuer?.industry === "string" && issuer.industry.trim()
      ? issuer.industry.trim()
      : typeof note.issuerIndustry === "string" && note.issuerIndustry.trim()
        ? note.issuerIndustry.trim()
        : DATA_NOT_AVAILABLE;
  const companySize =
    normalizeProspectusCompanySize(officerFields?.companySize) ?? DATA_NOT_AVAILABLE;
  const riskRating = isMarcSmeGrade(offerDetails?.risk_rating)
    ? offerDetails.risk_rating
    : DATA_NOT_AVAILABLE;
  return [
    { label: "Sector", value: industry },
    { label: "Company Size", value: companySize },
    { label: "Risk Rating", value: riskRating },
    { label: "Paymaster", value: textOrDna(note.paymasterName ?? paymaster?.name) },
  ];
}

export type PageThreeManualYear = Record<string, string | number | null | undefined>;
export type PageThreeManualYears = Record<string, PageThreeManualYear | undefined>;

/** Final resolved Income Statement values for one year (raw figures + stored calculated metrics). */
export function buildIncomeStatementResolvedRows(
  year: PageThreeYearValues,
  _manual: PageThreeManualYear | undefined
): Array<{ label: string; value: string; hint?: string | null }> {
  const yearRaw = rawAsRecord(year.raw);
  const revenue = parseNumber(yearRaw.turnover);
  const pat = parseNumber(yearRaw.plnpat);
  const pbt = parseNumber(yearRaw.plnpbt);

  const ebitValue = formatMoney(calculatedValue(year, "ebit"));

  const netProfitMarginValue = formatPercentFromPoints(calculatedValue(year, "profit_margin"));

  return [
    { label: "Revenue", value: formatMoney(revenue) },
    { label: "Cost of Sales", value: formatMoney(parseNumber(yearRaw.costOfSales)) },
    { label: "Gross Profit", value: formatMoney(parseNumber(yearRaw.grossProfit)) },
    { label: "EBITDA", value: formatMoney(parseNumber(yearRaw.ebitda)) },
    { label: "EBIT", value: ebitValue, hint: null },
    { label: "Profit Before Tax", value: formatMoney(pbt) },
    { label: "Profit After Tax", value: formatMoney(pat) },
    {
      label: "Net Profit Margin",
      // Stored PAT Margin from the approved Financial result (never CTOS profit_margin / PBT).
      value: netProfitMarginValue,
      hint: null,
    },
  ];
}

/** Final resolved Balance Sheet & Liquidity values including Total Liabilities. */
export function buildBalanceSheetResolvedRows(
  year: PageThreeYearValues,
  _manual: PageThreeManualYear | undefined
): Array<{ label: string; value: string; hint?: string | null }> {
  const yearRaw = rawAsRecord(year.raw);
  const currentAssets = parseNumber(yearRaw.bscatot);
  const currentLiabilities = parseNumber(yearRaw.curlib);

  // Totals and ratios are the stored Financial result values (no reconstruction here).
  const totalAssetsValue = formatMoney(calculatedValue(year, "totass"));

  const totalLiabilitiesValue = formatMoney(computePageThreeTotalLiabilities(year));

  const netWorthValue = formatMoney(calculatedValue(year, "networth"));

  const currRatioValue = formatMultiple(calculatedValue(year, "currat"));

  const quickRatioValue = formatMultiple(calculatedValue(year, "quickRatio"));

  return [
    { label: "Cash & Bank", value: formatMoney(parseNumber(yearRaw.cashAndBank)) },
    { label: "Trade Receivables", value: formatMoney(parseNumber(yearRaw.tradeReceivables)) },
    { label: "Trade Payables", value: formatMoney(parseNumber(yearRaw.tradePayables)) },
    { label: "Current Assets", value: formatMoney(currentAssets) },
    {
      label: "Total Assets",
      value: totalAssetsValue,
      hint: null,
    },
    { label: "Current Liabilities", value: formatMoney(currentLiabilities) },
    {
      label: "Total Liabilities",
      value: totalLiabilitiesValue,
      hint: null,
    },
    {
      label: "Total Equity",
      value: netWorthValue,
      hint: null,
    },
    {
      label: "Current Ratio",
      value: currRatioValue,
      hint: null,
    },
    {
      label: "Quick Ratio",
      value: quickRatioValue,
      hint: null,
    },
  ];
}

/** Final resolved Cash Flow, Coverage & Efficiency values. */
export function buildCoverageResolvedRows(
  year: PageThreeYearValues,
  _manual: PageThreeManualYear | undefined,
  _prevYear: PageThreeYearValues | undefined,
  _page2Override?: Partial<
    Record<(typeof PAGE_TWO_OFFICER_FINANCIAL_METRICS)[number]["key"], string | number | null>
  >
): Array<{ label: string; value: string; hint?: string | null }> {
  const yearRaw = rawAsRecord(year.raw);
  // Stored metrics from the approved Financial result (do not use officer overrides).
  const receivablesDays = calculatedValue(year, "receivablesDays");

  const interestCoverageValue = formatMultiple(calculatedValue(year, "interestCoverage"));

  const annualDebtService = parseNumber(yearRaw.annualDebtService);
  const dscrValue = formatMultiple(calculatedValue(year, "dscr"));

  const debtEqValue = formatMultiple(calculatedValue(year, "gear"));

  const roeValue = formatPercentFromPoints(calculatedValue(year, "return_on_equity"));

  const roaValue = formatPercentFromPoints(calculatedValue(year, "roa"));

  const assetTurnoverValue = formatMultiple(calculatedValue(year, "assetTurnover"));

  const receivablesDaysValue =
    receivablesDays != null ? formatDays(receivablesDays) : DATA_NOT_AVAILABLE;

  const payablesDaysValue = formatDays(calculatedValue(year, "payablesDays"));

  return [
    { label: "Operating Cash Flow", value: formatMoney(parseNumber(yearRaw.operatingCashFlow)) },
    { label: "Free Cash Flow", value: formatMoney(parseNumber(yearRaw.freeCashFlow)) },
    {
      label: "Interest Coverage",
      value: interestCoverageValue,
      hint: null,
    },
    { label: "Annual Debt Service", value: formatMoney(annualDebtService) },
    {
      label: "DSCR",
      value: dscrValue,
      hint: null,
    },
    {
      label: "Debt / Equity",
      value: debtEqValue,
      hint: null,
    },
    {
      label: "Return on Equity",
      value: roeValue,
      hint: null,
    },
    {
      label: "Return on Assets",
      value: roaValue,
      hint: null,
    },
    {
      label: "Receivables Days",
      value: receivablesDaysValue,
      hint: null,
    },
    {
      label: "Payables Days",
      value: payablesDaysValue,
      hint: null,
    },
    {
      label: "Asset Turnover",
      value: assetTurnoverValue,
      hint: null,
    },
  ];
}

function pivotYearRows(
  frozenYears: ProspectusFrozenFinancialYear[],
  manualYears: PageThreeManualYears | undefined,
  buildRows: (
    year: PageThreeYearValues,
    manual: PageThreeManualYear | undefined,
    calendarYear: string,
    prevYear?: PageThreeYearValues
  ) => Array<{ label: string; value: string; hint?: string | null }>,
  withTrend = false
): FinancialMetricTableModel {
  const yearHeaders = yearHeadersFromFrozen(frozenYears);
  const perYear = frozenYears.map((year, idx) => {
    const calendarYear = String(year.calendarYear);
    if (year.isPlaceholder) {
      // Display-only column — never resolve metrics or officer manuals.
      return buildRows(year, undefined, calendarYear, undefined).map((row) => ({
        ...row,
        value: DATA_NOT_AVAILABLE,
        hint: null,
      }));
    }
    const manual =
      manualYears?.[calendarYear] ??
      manualYears?.[year.financialYearEndIso] ??
      undefined;
    const prevYear = idx > 0 ? frozenYears[idx - 1] : undefined;
    return buildRows(year, manual, calendarYear, prevYear);
  });
  const metrics = perYear[0]?.map((row) => row.label) ?? [];

  return {
    yearHeaders,
    rows: metrics.map((metric, metricIndex) => ({
      metric,
      values: yearHeaders.map((_, yearIndex) => {
        const value = perYear[yearIndex]?.[metricIndex]?.value;
        return value ?? DATA_NOT_AVAILABLE;
      }),
      cellHints: yearHeaders.map((_, yearIndex) => {
        return perYear[yearIndex]?.[metricIndex]?.hint ?? null;
      }),
      ...(withTrend ? { trend: DATA_NOT_AVAILABLE } : {}),
    })),
  };
}

export function buildPageThreeIncomeStatementTable(
  frozenYears: ProspectusFrozenFinancialYear[],
  manualYears: PageThreeManualYears | undefined
): FinancialMetricTableModel {
  return pivotYearRows(frozenYears, manualYears, (year, manual) =>
    buildIncomeStatementResolvedRows(year, manual)
  );
}

export function buildPageThreeBalanceSheetTable(
  frozenYears: ProspectusFrozenFinancialYear[],
  manualYears: PageThreeManualYears | undefined
): FinancialMetricTableModel {
  return pivotYearRows(frozenYears, manualYears, (year, manual) =>
    buildBalanceSheetResolvedRows(year, manual)
  );
}

/** Coverage table including the ten rendered 3-Year Trend outcomes only. */
export function buildPageThreeCoverageTable(
  frozenYears: ProspectusFrozenFinancialYear[],
  manualYears: PageThreeManualYears | undefined,
  page2Overrides?: Page2FinancialOverrides
): FinancialMetricTableModel {
  const table = pivotYearRows(
    frozenYears,
    manualYears,
    (year, manual, calendarYear, prevYear) =>
      buildCoverageResolvedRows(year, manual, prevYear, page2OverrideForYear(page2Overrides, calendarYear)),
    false
  );
  return table;
}

export function pageThreeHidesIssuerIdentity(rows: CoreTermRow[]): boolean {
  const joined = rows.map((r) => `${r.label} ${r.value}`).join("\n");
  return !/issuer|registration|ssm|company name/i.test(joined);
}

/** Total Liabilities shown on Page 3: the stored Financial result value for the year. */
export function computePageThreeTotalLiabilities(year: PageThreeYearValues): number | null {
  return calculatedValue(year, "totlib");
}
