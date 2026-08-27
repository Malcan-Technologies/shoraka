import { formatCurrency } from "@cashsouk/config";
import {
  resolveCtosCurrentRatio,
  resolveCtosGearingRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosReturnOnEquityPercent,
  resolveCtosTotalAssetTurnover,
  resolveCtosTotalAssets,
  resolveCtosTotalLiabilities,
  isSoukscoreRiskRating,
  normalizeProspectusCompanySize,
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

function manualDisplay(
  value: string | number | null | undefined,
  kind: "money" | "ratio"
): string {
  const n = parseNumber(value);
  if (n == null) return DATA_NOT_AVAILABLE;
  return kind === "money" ? formatMoney(n) : `${n}`;
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
  return frozenYears.map((year) => ({
    key: year.financialYearEndIso,
    yearLabel: year.label,
    fyeLabel: year.fyeLabel,
    isPlaceholder: year.isPlaceholder === true,
  }));
}

function rawAsRecord(raw: ProspectusFrozenFinancialRaw): Record<string, unknown> {
  return { ...raw };
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
    paymasterRating?: string | null;
    confidenceGrading?: string | null;
  }
): CoreTermRow[] {
  const issuer = asRecord(note.issuerSnapshot);
  const paymaster = asRecord(note.paymasterSnapshot);
  const invoice = asRecord(note.invoiceSnapshot);
  const offerDetails = asRecord(invoice?.offer_details);
  const riskRating = isSoukscoreRiskRating(offerDetails?.risk_rating)
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
    {
      label: "Paymaster Grading",
      value: textOrDna(officerFields?.paymasterRating),
    },
    {
      label: "Confidence Grading",
      value: textOrDna(officerFields?.confidenceGrading),
    },
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
    paymasterRating?: string | null;
    confidenceGrading?: string | null;
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
  const riskRating = isSoukscoreRiskRating(offerDetails?.risk_rating)
    ? offerDetails.risk_rating
    : DATA_NOT_AVAILABLE;
  return [
    { label: "Industry", value: industry },
    { label: "Company Size", value: companySize },
    { label: "Risk Grade", value: riskRating },
    { label: "Paymaster", value: textOrDna(note.paymasterName ?? paymaster?.name) },
    {
      label: "Paymaster Grading",
      value: textOrDna(officerFields?.paymasterRating),
    },
    {
      label: "Confidence Grading",
      value: textOrDna(officerFields?.confidenceGrading),
    },
  ];
}

export type PageThreeManualYear = Record<string, string | number | null | undefined>;
export type PageThreeManualYears = Record<string, PageThreeManualYear | undefined>;

/** Final resolved Income Statement values for one year (derived + officer-entered). */
export function buildIncomeStatementResolvedRows(
  yearRaw: Record<string, unknown>,
  manual: PageThreeManualYear | undefined
): CoreTermRow[] {
  const revenue = parseNumber(yearRaw.turnover);
  const pat = parseNumber(yearRaw.plnpat);
  const pbt = parseNumber(yearRaw.plnpbt);
  return [
    { label: "Revenue", value: formatMoney(revenue) },
    { label: "Gross Profit", value: manualDisplay(manual?.grossProfit, "money") },
    { label: "EBITDA", value: manualDisplay(manual?.ebitda, "money") },
    { label: "EBIT", value: manualDisplay(manual?.ebit, "money") },
    { label: "Profit Before Tax", value: formatMoney(pbt) },
    { label: "Profit After Tax", value: formatMoney(pat) },
    {
      label: "Net Profit Margin",
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — PAT Margin (never profit_margin / PBT).
      value: formatPercentFromPoints(
        resolveCtosPatMarginPercent({ plnpat: pat, turnover: revenue })
      ),
    },
  ];
}

/** Final resolved Balance Sheet & Liquidity values including Total Liabilities. */
export function buildBalanceSheetResolvedRows(
  yearRaw: Record<string, unknown>,
  manual: PageThreeManualYear | undefined
): CoreTermRow[] {
  const currentAssets = parseNumber(yearRaw.bscatot);
  const currentLiabilities = parseNumber(yearRaw.curlib);
  // CTOS ENQWS v5.11.0 — direct totass / totlib / currat only (no component reconstruction).
  const totalAssets = resolveCtosTotalAssets({ totass: parseNumber(yearRaw.totass) });
  const totalLiabilities = resolveCtosTotalLiabilities({ totlib: parseNumber(yearRaw.totlib) });

  return [
    { label: "Cash & Bank", value: manualDisplay(manual?.cashAndBank, "money") },
    { label: "Trade Receivables", value: manualDisplay(manual?.tradeReceivables, "money") },
    { label: "Current Assets", value: formatMoney(currentAssets) },
    { label: "Total Assets", value: formatMoney(totalAssets) },
    { label: "Current Liabilities", value: formatMoney(currentLiabilities) },
    { label: "Total Liabilities", value: formatMoney(totalLiabilities) },
    { label: "Total Equity", value: manualDisplay(manual?.totalEquity, "money") },
    {
      label: "Current Ratio",
      value: formatMultiple(
        resolveCtosCurrentRatio({
          currat: parseNumber(yearRaw.currat),
        })
      ),
    },
    { label: "Quick Ratio", value: manualDisplay(manual?.quickRatio, "ratio") },
  ];
}

/** Final resolved Cash Flow, Coverage & Efficiency values. */
export function buildCoverageResolvedRows(
  yearRaw: Record<string, unknown>,
  manual: PageThreeManualYear | undefined,
  page2Override?: Partial<
    Record<(typeof PAGE_TWO_OFFICER_FINANCIAL_METRICS)[number]["key"], string | number | null>
  >
): CoreTermRow[] {
  const interestCoverage = parseNumber(page2Override?.interestCoverage);
  const dscr = parseNumber(page2Override?.dscr);
  const receivablesDays = parseNumber(page2Override?.receivablesDays);
  return [
    { label: "Interest Coverage", value: formatMultiple(interestCoverage) },
    { label: "DSCR", value: formatMultiple(dscr) },
    {
      label: "Debt / Equity",
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — gear | totlib/networth (x)
      value: formatMultiple(
        resolveCtosGearingRatio({
          gear: parseNumber(yearRaw.gear),
          totlib: parseNumber(yearRaw.totlib),
          networth: parseNumber(yearRaw.networth),
        })
      ),
    },
    {
      label: "Return on Equity",
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — direct r:return_on_equity only.
      value: formatPercentFromPoints(
        resolveCtosReturnOnEquityPercent({
          return_on_equity: parseNumber(yearRaw.return_on_equity),
        })
      ),
    },
    {
      label: "Return on Assets",
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — plnpat/totass*100
      value: formatPercentFromPoints(
        resolveCtosReturnOnAssetsPercent({
          plnpat: parseNumber(yearRaw.plnpat),
          totass: parseNumber(yearRaw.totass),
        })
      ),
    },
    {
      label: "Receivables Days",
      value:
        receivablesDays != null && Number.isInteger(receivablesDays)
          ? formatDays(receivablesDays)
          : DATA_NOT_AVAILABLE,
    },
    {
      label: "Payables Days",
      value: formatDays(parseNumber(manual?.payablesDays)),
    },
    {
      label: "Asset Turnover",
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — turnover/totass
      value: formatMultiple(
        resolveCtosTotalAssetTurnover({
          turnover: parseNumber(yearRaw.turnover),
          totass: parseNumber(yearRaw.totass),
        })
      ),
    },
  ];
}

function pivotYearRows(
  frozenYears: ProspectusFrozenFinancialYear[],
  manualYears: PageThreeManualYears | undefined,
  buildRows: (
    yearRaw: Record<string, unknown>,
    manual: PageThreeManualYear | undefined,
    year: string
  ) => CoreTermRow[],
  withTrend = false
): FinancialMetricTableModel {
  const yearHeaders = yearHeadersFromFrozen(frozenYears);
  const perYear = frozenYears.map((year) => {
    const calendarYear = String(year.calendarYear);
    if (year.isPlaceholder) {
      // Display-only column — never resolve metrics or officer manuals.
      return buildRows({}, undefined, calendarYear).map((row) => ({
        ...row,
        value: DATA_NOT_AVAILABLE,
      }));
    }
    const manual =
      manualYears?.[calendarYear] ??
      manualYears?.[year.financialYearEndIso] ??
      undefined;
    return buildRows(rawAsRecord(year.raw), manual, calendarYear);
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
      ...(withTrend ? { trend: DATA_NOT_AVAILABLE } : {}),
    })),
  };
}

export function buildPageThreeIncomeStatementTable(
  frozenYears: ProspectusFrozenFinancialYear[],
  manualYears: PageThreeManualYears | undefined
): FinancialMetricTableModel {
  return pivotYearRows(frozenYears, manualYears, (yearRaw, manual) =>
    buildIncomeStatementResolvedRows(yearRaw, manual)
  );
}

export function buildPageThreeBalanceSheetTable(
  frozenYears: ProspectusFrozenFinancialYear[],
  manualYears: PageThreeManualYears | undefined
): FinancialMetricTableModel {
  return pivotYearRows(frozenYears, manualYears, (yearRaw, manual) =>
    buildBalanceSheetResolvedRows(yearRaw, manual)
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
    (yearRaw, manual, year) =>
      buildCoverageResolvedRows(yearRaw, manual, page2OverrideForYear(page2Overrides, year)),
    false
  );
  return table;
}

export function pageThreeHidesIssuerIdentity(rows: CoreTermRow[]): boolean {
  const joined = rows.map((r) => `${r.label} ${r.value}`).join("\n");
  return !/issuer|registration|ssm|company name/i.test(joined);
}

/** Expose Total Liabilities helper usage for tests (same inputs as Page 3 builder). */
export function computePageThreeTotalLiabilities(yearRaw: Record<string, unknown>): number | null {
  return resolveCtosTotalLiabilities({
    totlib: parseNumber(yearRaw.totlib),
  });
}
