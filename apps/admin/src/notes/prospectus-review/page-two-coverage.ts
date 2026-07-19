import { formatCurrency } from "@cashsouk/config";
import {
  MARKETPLACE_MIN_COMMIT_MYR,
  calculateCurrentRatio,
  calculateProfitMargin,
  calculateReturnOnEquity,
  type NoteDetail,
} from "@cashsouk/types";
import type { CoreTermRow } from "./core-terms";

const DATA_NOT_AVAILABLE = "Data not available";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textOrDna(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return DATA_NOT_AVAILABLE;
}

function formatDateUtc(value: string | null | undefined): string {
  if (!value) return DATA_NOT_AVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DATA_NOT_AVAILABLE;
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Same source as Page 2 builder: invoice_snapshot.details.value */
export function parseInvoiceSnapshotFaceValue(invoiceSnapshot: unknown): number | null {
  const invoice = asRecord(invoiceSnapshot);
  const details = asRecord(invoice?.details);
  return parseMoney(details?.value);
}

function formatMoneyOrDna(value: number | null): string {
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

function selectComparisonYears(yearKeys: string[]): string[] {
  const years = yearKeys
    .filter((key) => /^\d{4}$/.test(key))
    .map(Number)
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => b - a)
    .slice(0, 3)
    .sort((a, b) => a - b);
  return years.map(String);
}

function metricForYear(
  key:
    | "revenue"
    | "profitAfterTax"
    | "netProfitMargin"
    | "roe"
    | "currentRatio"
    | "netDebtEquity"
    | "interestCoverage"
    | "dscr"
    | "receivablesDays",
  raw: Record<string, unknown>
): string {
  switch (key) {
    case "revenue":
      return formatMoneyOrDna(parseMoney(raw.turnover));
    case "profitAfterTax":
      return formatMoneyOrDna(parseMoney(raw.plnpat));
    case "netProfitMargin": {
      const pat = parseMoney(raw.plnpat);
      const rev = parseMoney(raw.turnover);
      if (pat == null || rev == null) return DATA_NOT_AVAILABLE;
      return formatPercentFromRatio(calculateProfitMargin(pat, rev));
    }
    case "roe": {
      const pat = parseMoney(raw.plnpat);
      const equity = parseMoney(raw.bsqpuc);
      if (pat == null || equity == null) return DATA_NOT_AVAILABLE;
      return formatPercentFromRatio(calculateReturnOnEquity(pat, equity));
    }
    case "currentRatio": {
      const assets = parseMoney(raw.bscatot);
      const liabilities = parseMoney(raw.curlib);
      if (assets == null || liabilities == null) return DATA_NOT_AVAILABLE;
      return formatMultiple(calculateCurrentRatio(assets, liabilities));
    }
    case "netDebtEquity":
    case "interestCoverage":
    case "dscr":
    case "receivablesDays":
      return DATA_NOT_AVAILABLE;
    default:
      return DATA_NOT_AVAILABLE;
  }
}

function joinYearValues(
  years: string[],
  byYear: Record<string, Record<string, unknown>>,
  key: Parameters<typeof metricForYear>[0]
): string {
  if (years.length === 0) return DATA_NOT_AVAILABLE;
  return years
    .map((year) => `FY${year}: ${metricForYear(key, byYear[year] ?? {})}`)
    .join(" · ");
}

/** Invoice & Paymaster Information — mirrors Page 2 mapper display rules. */
export function buildInvoicePaymasterVerificationRows(note: NoteDetail): CoreTermRow[] {
  const paymaster = asRecord(note.paymasterSnapshot);
  const faceValue = parseInvoiceSnapshotFaceValue(note.invoiceSnapshot);
  return [
    { label: "Invoice Amount", value: formatMoneyOrDna(faceValue) },
    { label: "Invoice Due Date", value: formatDateUtc(note.maturityDate) },
    { label: "Paymaster", value: textOrDna(note.paymasterName ?? paymaster?.name) },
    {
      label: "Nature of Paymaster",
      value: textOrDna(paymaster?.entity_type ?? paymaster?.entityType),
    },
    { label: "Deed of Assignment", value: DATA_NOT_AVAILABLE },
    { label: "Paymaster Rating", value: DATA_NOT_AVAILABLE },
    { label: "Confidence Grading", value: DATA_NOT_AVAILABLE },
  ];
}

/**
 * Compact 3-year financial comparison verification using Application unaudited years.
 * Same supported helpers as Page 2; unsupported rows stay Data not available.
 */
export function buildPageTwoFinancialComparisonRows(
  financialStatements: unknown
): CoreTermRow[] {
  const root = asRecord(financialStatements);
  const unaudited = asRecord(root?.unaudited_by_year) ?? {};
  const years = selectComparisonYears(Object.keys(unaudited));
  const byYear: Record<string, Record<string, unknown>> = {};
  for (const year of years) {
    byYear[year] = asRecord(unaudited[year]) ?? {};
  }

  return [
    { label: "Revenue", value: joinYearValues(years, byYear, "revenue") },
    { label: "Profit After Tax", value: joinYearValues(years, byYear, "profitAfterTax") },
    { label: "Net Profit Margin", value: joinYearValues(years, byYear, "netProfitMargin") },
    { label: "Return on Equity", value: joinYearValues(years, byYear, "roe") },
    { label: "Current Ratio", value: joinYearValues(years, byYear, "currentRatio") },
    { label: "Debt / Equity", value: joinYearValues(years, byYear, "netDebtEquity") },
    { label: "Interest Coverage", value: joinYearValues(years, byYear, "interestCoverage") },
    { label: "DSCR", value: joinYearValues(years, byYear, "dscr") },
    { label: "Receivables Days", value: joinYearValues(years, byYear, "receivablesDays") },
    {
      label: "Full comparison table",
      value: "Verify complete layout in Page 2 Preview",
    },
  ];
}

export function buildRiskScaleVerificationRows(note: NoteDetail): CoreTermRow[] {
  return [
    {
      label: "Risk Rating Scale",
      value: "Fixed SoukScore AAA–B scale on prospectus Page 2",
    },
    {
      label: "Current selected rating",
      value: textOrDna(note.riskRating),
    },
    {
      label: "Scale labels and definitions",
      value: DATA_NOT_AVAILABLE,
    },
  ];
}

export function buildInvestmentCtaVerificationRows(): CoreTermRow[] {
  const minMoney = formatCurrency(MARKETPLACE_MIN_COMMIT_MYR);
  return [
    { label: "CTA heading", value: "INVEST WITH CONFIDENCE" },
    { label: "CTA button", value: "INVEST NOW" },
    { label: "CTA wording", value: DATA_NOT_AVAILABLE },
    { label: "Minimum investment", value: `Minimum investment: ${minMoney}` },
  ];
}

export function pageTwoCoverageHidesIssuerIdentity(rows: CoreTermRow[]): boolean {
  const joined = rows.map((r) => `${r.label} ${r.value}`).join("\n");
  return !/registration|ssm|company name/i.test(joined);
}
