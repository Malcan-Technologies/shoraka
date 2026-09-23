import { formatCurrency } from "@cashsouk/config";
import {
  resolveCtosGearingRatio,
  resolveCtosCurrentRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosReturnOnEquityPercent,
  resolveCtosTotalAssetTurnover,
  resolveCtosTotalAssets,
  resolveCtosTotalLiabilities,
  isMarcSmeGrade,
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

/** Final resolved Income Statement values for one year (derived + officer-entered). */
export function buildIncomeStatementResolvedRows(
  yearRaw: Record<string, unknown>,
  _manual: PageThreeManualYear | undefined
): Array<{ label: string; value: string; hint?: string | null }> {
  const revenue = parseNumber(yearRaw.turnover);
  const pat = parseNumber(yearRaw.plnpat);
  const pbt = parseNumber(yearRaw.plnpbt);
  const ebit = parseNumber(yearRaw.ebit);

  const ebitValue = formatMoney(ebit);
  const ebitHint =
    ebitValue === DATA_NOT_AVAILABLE
      ? pat != null
        ? "Missing: Interest Costs"
        : pbt != null
          ? "Missing: Interest Costs"
          : "Missing: Profit / Loss Before Tax"
      : null;

  const netProfitMarginPoints = resolveCtosPatMarginPercent({ plnpat: pat, turnover: revenue });
  const netProfitMarginValue = formatPercentFromPoints(netProfitMarginPoints);
  const netProfitMarginHint =
    netProfitMarginValue === DATA_NOT_AVAILABLE
      ? pat == null
        ? "Missing: Profit / Loss After Tax"
        : revenue == null
          ? "Missing: Revenue / Turnover"
          : "Missing: Net Profit Margin"
      : null;

  return [
    { label: "Revenue", value: formatMoney(revenue) },
    { label: "Cost of Sales", value: formatMoney(parseNumber(yearRaw.costOfSales)) },
    { label: "Gross Profit", value: formatMoney(parseNumber(yearRaw.grossProfit)) },
    { label: "EBITDA", value: formatMoney(parseNumber(yearRaw.ebitda)) },
    { label: "EBIT", value: ebitValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : ebitValue, hint: ebitValue === DATA_NOT_AVAILABLE ? ebitHint : null },
    { label: "Profit Before Tax", value: formatMoney(pbt) },
    { label: "Profit After Tax", value: formatMoney(pat) },
    {
      label: "Net Profit Margin",
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — PAT Margin (never profit_margin / PBT).
      value:
        netProfitMarginValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : netProfitMarginValue,
      hint: netProfitMarginValue === DATA_NOT_AVAILABLE ? netProfitMarginHint : null,
    },
  ];
}

/** Final resolved Balance Sheet & Liquidity values including Total Liabilities. */
export function buildBalanceSheetResolvedRows(
  yearRaw: Record<string, unknown>,
  _manual: PageThreeManualYear | undefined
): Array<{ label: string; value: string; hint?: string | null }> {
  const currentAssets = parseNumber(yearRaw.bscatot);
  const currentLiabilities = parseNumber(yearRaw.curlib);
  const netWorth = parseNumber(yearRaw.networth);
  // CTOS ENQWS v5.11.0 — direct totass / totlib / currat only (no component reconstruction).
  const rawTotalAssets = parseNumber(yearRaw.totass);
  const rawTotalLiabilities = parseNumber(yearRaw.totlib);
  const rawCurrat = parseNumber(yearRaw.currat);
  const rawQuickRatio = parseNumber(yearRaw.quickRatio);

  const totalAssets = resolveCtosTotalAssets({ totass: rawTotalAssets });
  const totalLiabilities = resolveCtosTotalLiabilities({ totlib: rawTotalLiabilities });

  const totalAssetsValue = formatMoney(totalAssets);
  const totalAssetsHint = totalAssetsValue === DATA_NOT_AVAILABLE ? "Missing: Total Assets" : null;

  const totalLiabilitiesValue = formatMoney(totalLiabilities);
  const totalLiabilitiesHint =
    totalLiabilitiesValue === DATA_NOT_AVAILABLE ? "Missing: Total Liabilities" : null;

  const netWorthValue = formatMoney(netWorth);
  const netWorthHint =
    netWorthValue === DATA_NOT_AVAILABLE ? "Missing: Total Equity / Net Worth" : null;

  const currRatioValue = formatMultiple(
    resolveCtosCurrentRatio({
      currat: rawCurrat,
    })
  );
  const currRatioHint =
    currRatioValue === DATA_NOT_AVAILABLE
      ? currentAssets == null
        ? "Missing: Current Assets"
        : currentLiabilities == null
          ? "Missing: Current Liabilities"
          : "Missing: Current Ratio"
      : null;

  const quickRatioValue = formatMultiple(rawQuickRatio);
  const quickRatioHint =
    quickRatioValue === DATA_NOT_AVAILABLE
      ? parseNumber(yearRaw.cashAndBank) == null
        ? "Missing: Cash & Bank"
        : parseNumber(yearRaw.tradeReceivables) == null
          ? "Missing: Trade Receivables"
          : currentLiabilities == null
            ? "Missing: Current Liabilities"
            : "Missing: Quick Ratio"
      : null;

  return [
    { label: "Cash & Bank", value: formatMoney(parseNumber(yearRaw.cashAndBank)) },
    { label: "Trade Receivables", value: formatMoney(parseNumber(yearRaw.tradeReceivables)) },
    { label: "Trade Payables", value: formatMoney(parseNumber(yearRaw.tradePayables)) },
    { label: "Current Assets", value: formatMoney(currentAssets) },
    {
      label: "Total Assets",
      value: totalAssetsValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : totalAssetsValue,
      hint: totalAssetsValue === DATA_NOT_AVAILABLE ? totalAssetsHint : null,
    },
    { label: "Current Liabilities", value: formatMoney(currentLiabilities) },
    {
      label: "Total Liabilities",
      value: totalLiabilitiesValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : totalLiabilitiesValue,
      hint: totalLiabilitiesValue === DATA_NOT_AVAILABLE ? totalLiabilitiesHint : null,
    },
    {
      label: "Total Equity",
      value: netWorthValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : netWorthValue,
      hint: netWorthValue === DATA_NOT_AVAILABLE ? netWorthHint : null,
    },
    {
      label: "Current Ratio",
      value: currRatioValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : currRatioValue,
      hint: currRatioValue === DATA_NOT_AVAILABLE ? currRatioHint : null,
    },
    {
      label: "Quick Ratio",
      value: quickRatioValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : quickRatioValue,
      hint: quickRatioValue === DATA_NOT_AVAILABLE ? quickRatioHint : null,
    },
  ];
}

/** Final resolved Cash Flow, Coverage & Efficiency values. */
export function buildCoverageResolvedRows(
  yearRaw: Record<string, unknown>,
  _manual: PageThreeManualYear | undefined,
  prevYearRaw: Record<string, unknown> | undefined,
  _page2Override?: Partial<
    Record<(typeof PAGE_TWO_OFFICER_FINANCIAL_METRICS)[number]["key"], string | number | null>
  >
): Array<{ label: string; value: string; hint?: string | null }> {
  // System-derived metrics from Stage 4A raw fields (do not use officer overrides).
  const interestCoverage = parseNumber(yearRaw.interestCoverage);
  const dscr = parseNumber(yearRaw.dscr);
  const receivablesDays = parseNumber(yearRaw.receivablesDays);

  const ebit = parseNumber(yearRaw.ebit);
  const interestCoverageValue = formatMultiple(interestCoverage);
  const interestCoverageHint =
    interestCoverageValue === DATA_NOT_AVAILABLE
      ? ebit != null
        ? "Missing: Interest Costs"
        : "Missing: EBIT"
      : null;

  const annualDebtService = parseNumber(yearRaw.annualDebtService);
  const dscrValue = formatMultiple(dscr);
  const dscrHint =
    dscrValue === DATA_NOT_AVAILABLE
      ? annualDebtService == null
        ? "Missing: Annual Debt Service"
        : "Missing: DSCR"
      : null;

  const totlib = parseNumber(yearRaw.totlib);
  const networth = parseNumber(yearRaw.networth);
  const gear = parseNumber(yearRaw.gear);
  const debtEqRatio = resolveCtosGearingRatio({ gear, totlib, networth });
  const debtEqValue = formatMultiple(debtEqRatio);
  const debtEqHint =
    debtEqValue === DATA_NOT_AVAILABLE
      ? networth == null
        ? "Missing: Total Equity / Net Worth"
        : totlib == null
          ? "Missing: Total Liabilities"
          : "Missing: Debt / Equity"
      : null;

  const roePoints = resolveCtosReturnOnEquityPercent({
    return_on_equity: parseNumber(yearRaw.return_on_equity),
  });
  const roeValue = formatPercentFromPoints(roePoints);
  const roeHint = roeValue === DATA_NOT_AVAILABLE ? "Missing: Return on Equity" : null;

  const roaValue = formatPercentFromPoints(
    resolveCtosReturnOnAssetsPercent({
      plnpat: parseNumber(yearRaw.plnpat),
      totass: parseNumber(yearRaw.totass),
    })
  );
  const roaHint =
    roaValue === DATA_NOT_AVAILABLE
      ? parseNumber(yearRaw.plnpat) == null
        ? "Missing: Profit / Loss After Tax"
        : parseNumber(yearRaw.totass) == null
          ? "Missing: Total Assets"
          : "Missing: Return on Assets"
      : null;

  const turnover = parseNumber(yearRaw.turnover);
  const totass = parseNumber(yearRaw.totass);
  const assetTurnoverValue = formatMultiple(
    resolveCtosTotalAssetTurnover({
      turnover,
      totass,
    })
  );
  const assetTurnoverHint =
    assetTurnoverValue === DATA_NOT_AVAILABLE
      ? turnover == null
        ? "Missing: Revenue / Turnover"
        : totass == null
          ? "Missing: Total Assets"
          : "Missing: Asset Turnover"
      : null;

  const receivablesDaysValue =
    receivablesDays != null ? formatDays(receivablesDays) : DATA_NOT_AVAILABLE;
  const prevTradeReceivables = prevYearRaw ? parseNumber(prevYearRaw.tradeReceivables) : null;
  const receivablesDaysHint =
    receivablesDaysValue === DATA_NOT_AVAILABLE
      ? prevTradeReceivables == null
        ? "Missing: previous financial year Trade Receivables"
        : turnover == null
          ? "Missing: Revenue / Turnover"
          : "Missing: Receivables Days"
      : null;

  const payablesDaysValue = formatDays(parseNumber(yearRaw.payablesDays));
  const tradePayables = parseNumber(yearRaw.tradePayables);
  const costOfSales = parseNumber(yearRaw.costOfSales);
  const payablesDaysHint =
    payablesDaysValue === DATA_NOT_AVAILABLE
      ? tradePayables == null
        ? "Missing: Trade Payables"
        : costOfSales == null
          ? "Missing: Cost of Sales"
          : "Missing: Payables Days"
      : null;

  return [
    { label: "Operating Cash Flow", value: formatMoney(parseNumber(yearRaw.operatingCashFlow)) },
    { label: "Free Cash Flow", value: formatMoney(parseNumber(yearRaw.freeCashFlow)) },
    {
      label: "Interest Coverage",
      value: interestCoverageValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : interestCoverageValue,
      hint: interestCoverageValue === DATA_NOT_AVAILABLE ? interestCoverageHint : null,
    },
    { label: "Annual Debt Service", value: formatMoney(annualDebtService) },
    {
      label: "DSCR",
      value: dscrValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : dscrValue,
      hint: dscrValue === DATA_NOT_AVAILABLE ? dscrHint : null,
    },
    {
      label: "Debt / Equity",
      value: debtEqValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : debtEqValue,
      hint: debtEqValue === DATA_NOT_AVAILABLE ? debtEqHint : null,
    },
    {
      label: "Return on Equity",
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — direct r:return_on_equity only.
      value: roeValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : roeValue,
      hint: roeValue === DATA_NOT_AVAILABLE ? roeHint : null,
    },
    {
      label: "Return on Assets",
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — plnpat/totass*100
      value: roaValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : roaValue,
      hint: roaValue === DATA_NOT_AVAILABLE ? roaHint : null,
    },
    {
      label: "Receivables Days",
      value: receivablesDaysValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : receivablesDaysValue,
      hint: receivablesDaysValue === DATA_NOT_AVAILABLE ? receivablesDaysHint : null,
    },
    {
      label: "Payables Days",
      value: payablesDaysValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : payablesDaysValue,
      hint: payablesDaysValue === DATA_NOT_AVAILABLE ? payablesDaysHint : null,
    },
    {
      label: "Asset Turnover",
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — turnover/totass
      value: assetTurnoverValue === DATA_NOT_AVAILABLE ? "Cannot calculate" : assetTurnoverValue,
      hint: assetTurnoverValue === DATA_NOT_AVAILABLE ? assetTurnoverHint : null,
    },
  ];
}

function pivotYearRows(
  frozenYears: ProspectusFrozenFinancialYear[],
  manualYears: PageThreeManualYears | undefined,
  buildRows: (
    yearRaw: Record<string, unknown>,
    manual: PageThreeManualYear | undefined,
    year: string,
    prevYearRaw?: Record<string, unknown>
  ) => Array<{ label: string; value: string; hint?: string | null }>,
  withTrend = false
): FinancialMetricTableModel {
  const yearHeaders = yearHeadersFromFrozen(frozenYears);
  const perYear = frozenYears.map((year, idx) => {
    const calendarYear = String(year.calendarYear);
    if (year.isPlaceholder) {
      // Display-only column — never resolve metrics or officer manuals.
      return buildRows({}, undefined, calendarYear, undefined).map((row) => ({
        ...row,
        value: DATA_NOT_AVAILABLE,
        hint: null,
      }));
    }
    const manual =
      manualYears?.[calendarYear] ??
      manualYears?.[year.financialYearEndIso] ??
      undefined;
    const prevYearRaw = idx > 0 ? rawAsRecord(frozenYears[idx - 1]?.raw) ?? undefined : undefined;
    return buildRows(rawAsRecord(year.raw), manual, calendarYear, prevYearRaw);
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
    (yearRaw, manual, year, prevYearRaw) =>
      buildCoverageResolvedRows(yearRaw, manual, prevYearRaw, page2OverrideForYear(page2Overrides, year)),
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
