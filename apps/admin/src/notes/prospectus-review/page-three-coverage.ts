import { formatCurrency } from "@cashsouk/config";
import {
  calculateCurrentRatio,
  calculateProfitMargin,
  calculateReturnOnEquity,
  computeTotalAssets,
  computeTotalLiabilities,
  fyEndDateForYear,
  isSoukscoreRiskRating,
  type NoteDetail,
} from "@cashsouk/types";
import type { CoreTermRow } from "./core-terms";
import type { FinancialMetricTableModel } from "./financial-metric-table";

const DATA_NOT_AVAILABLE = "Data not available";
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

function formatPercentFromRatio(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return DATA_NOT_AVAILABLE;
  const percent = ratio * 100;
  const fixed = percent.toFixed(2).replace(/\.?0+$/, "");
  return `${fixed}%`;
}

function formatMultiple(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return DATA_NOT_AVAILABLE;
  const fixed = value.toFixed(2).replace(/\.?0+$/, "");
  return `${fixed}x`;
}

function manualDisplay(
  value: string | number | null | undefined,
  kind: "money" | "ratio"
): string {
  const n = parseNumber(value);
  if (n == null) return DATA_NOT_AVAILABLE;
  return kind === "money" ? formatMoney(n) : `${n}`;
}

export function selectPageThreeYears(financialStatements: unknown): string[] {
  const root = asRecord(financialStatements);
  const unaudited = asRecord(root?.unaudited_by_year) ?? {};
  return Object.keys(unaudited)
    .filter((key) => /^\d{4}$/.test(key))
    .map(Number)
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => b - a)
    .slice(0, 3)
    .sort((a, b) => a - b)
    .map(String);
}

function readFinancialYearEndIso(financialStatements: unknown): string | null {
  const root = asRecord(financialStatements);
  const questionnaire = asRecord(root?.questionnaire);
  const value = questionnaire?.financial_year_end;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatFyeLabel(financialYearEndIso: string | null, year: string): string {
  if (!financialYearEndIso) return DATA_NOT_AVAILABLE;
  const end = fyEndDateForYear({ financial_year_end: financialYearEndIso }, Number(year));
  if (!end) return DATA_NOT_AVAILABLE;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(end);
}

function buildYearHeaders(financialStatements: unknown) {
  const years = selectPageThreeYears(financialStatements);
  const fyeIso = readFinancialYearEndIso(financialStatements);
  return years.map((year) => ({
    key: year,
    yearLabel: `FY${year}`,
    fyeLabel: formatFyeLabel(fyeIso, year),
  }));
}

function readYearRaw(
  financialStatements: unknown,
  year: string
): Record<string, unknown> {
  const root = asRecord(financialStatements);
  const unaudited = asRecord(root?.unaudited_by_year) ?? {};
  return asRecord(unaudited[year]) ?? {};
}

export function buildPageThreeOverviewRows(financialStatements: unknown): CoreTermRow[] {
  const years = selectPageThreeYears(financialStatements);
  return [
    { label: "Page title", value: PAGE_THREE_TITLE },
    { label: "Subtitle", value: DATA_NOT_AVAILABLE },
    {
      label: "Financial years included",
      value: years.length > 0 ? years.map((y) => `FY${y}`).join(" · ") : DATA_NOT_AVAILABLE,
    },
  ];
}

export function buildPageThreeMetadataRows(
  note: NoteDetail,
  officerGradings?: {
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
    { label: "Sector", value: textOrDna(issuer?.industry ?? note.issuerIndustry) },
    { label: "Risk Rating", value: riskRating },
    { label: "Paymaster", value: textOrDna(note.paymasterName ?? paymaster?.name) },
    {
      label: "Paymaster Grading",
      value: textOrDna(officerGradings?.paymasterRating),
    },
    {
      label: "Confidence Grading",
      value: textOrDna(officerGradings?.confidenceGrading),
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
      value:
        revenue != null && pat != null
          ? formatPercentFromRatio(calculateProfitMargin(pat, revenue))
          : DATA_NOT_AVAILABLE,
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
  const totalAssets = computeTotalAssets({
    total_assets: null,
    fixed_assets: parseNumber(yearRaw.bsfatot),
    other_assets: parseNumber(yearRaw.othass),
    current_assets: currentAssets,
    non_current_assets: parseNumber(yearRaw.bsclbank),
  });
  const totalLiabilities = computeTotalLiabilities({
    total_liabilities: null,
    current_liabilities: currentLiabilities,
    long_term_liabilities: parseNumber(yearRaw.bsslltd),
    non_current_liabilities: parseNumber(yearRaw.bsclstd),
  });

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
      value:
        currentAssets != null && currentLiabilities != null
          ? formatMultiple(calculateCurrentRatio(currentAssets, currentLiabilities))
          : DATA_NOT_AVAILABLE,
    },
    { label: "Quick Ratio", value: manualDisplay(manual?.quickRatio, "ratio") },
  ];
}

/** Final resolved Cash Flow, Coverage & Efficiency values. */
export function buildCoverageResolvedRows(
  yearRaw: Record<string, unknown>,
  manual: PageThreeManualYear | undefined
): CoreTermRow[] {
  const pat = parseNumber(yearRaw.plnpat);
  const equity = parseNumber(yearRaw.bsqpuc);
  return [
    { label: "Operating Cash Flow", value: manualDisplay(manual?.operatingCashFlow, "money") },
    { label: "Free Cash Flow", value: manualDisplay(manual?.freeCashFlow, "money") },
    { label: "Interest Coverage", value: manualDisplay(manual?.interestCoverage, "ratio") },
    { label: "DSCR", value: manualDisplay(manual?.dscr, "ratio") },
    { label: "Debt / Equity", value: manualDisplay(manual?.debtEquity, "ratio") },
    {
      label: "Return on Equity",
      value:
        pat != null && equity != null
          ? formatPercentFromRatio(calculateReturnOnEquity(pat, equity))
          : DATA_NOT_AVAILABLE,
    },
    { label: "Return on Assets", value: manualDisplay(manual?.returnOnAssets, "ratio") },
    { label: "Receivables Days", value: manualDisplay(manual?.receivablesDays, "ratio") },
    { label: "Payables Days", value: manualDisplay(manual?.payablesDays, "ratio") },
    { label: "Asset Turnover", value: manualDisplay(manual?.assetTurnover, "ratio") },
  ];
}

function pivotYearRows(
  financialStatements: unknown,
  manualYears: PageThreeManualYears | undefined,
  buildRows: (
    yearRaw: Record<string, unknown>,
    manual: PageThreeManualYear | undefined
  ) => CoreTermRow[],
  withTrend = false
): FinancialMetricTableModel {
  const yearHeaders = buildYearHeaders(financialStatements);
  const perYear = yearHeaders.map((header) =>
    buildRows(readYearRaw(financialStatements, header.key), manualYears?.[header.key])
  );
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
  financialStatements: unknown,
  manualYears: PageThreeManualYears | undefined
): FinancialMetricTableModel {
  return pivotYearRows(financialStatements, manualYears, buildIncomeStatementResolvedRows);
}

export function buildPageThreeBalanceSheetTable(
  financialStatements: unknown,
  manualYears: PageThreeManualYears | undefined
): FinancialMetricTableModel {
  return pivotYearRows(financialStatements, manualYears, buildBalanceSheetResolvedRows);
}

/** Coverage table including the ten rendered 3-Year Trend outcomes only. */
export function buildPageThreeCoverageTable(
  financialStatements: unknown,
  manualYears: PageThreeManualYears | undefined
): FinancialMetricTableModel {
  const table = pivotYearRows(
    financialStatements,
    manualYears,
    buildCoverageResolvedRows,
    true
  );
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      trend: PAGE_THREE_RENDERED_TREND_METRICS.includes(
        row.metric as (typeof PAGE_THREE_RENDERED_TREND_METRICS)[number]
      )
        ? DATA_NOT_AVAILABLE
        : undefined,
    })),
  };
}

export function pageThreeHidesIssuerIdentity(rows: CoreTermRow[]): boolean {
  const joined = rows.map((r) => `${r.label} ${r.value}`).join("\n");
  return !/issuer|registration|ssm|company name/i.test(joined);
}

/** Expose Total Liabilities helper usage for tests (same inputs as Page 3 builder). */
export function computePageThreeTotalLiabilities(yearRaw: Record<string, unknown>): number {
  return computeTotalLiabilities({
    total_liabilities: null,
    current_liabilities: parseNumber(yearRaw.curlib),
    long_term_liabilities: parseNumber(yearRaw.bsslltd),
    non_current_liabilities: parseNumber(yearRaw.bsclstd),
  });
}
