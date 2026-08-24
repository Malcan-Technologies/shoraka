import { formatCurrency } from "@cashsouk/config";
import {
  resolveCtosCurrentRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnEquityPercent,
  fyEndDateForYear,
  type NoteDetail,
} from "@cashsouk/types";
import type { CoreTermRow } from "./core-terms";
import type { FinancialMetricTableModel } from "./financial-metric-table";

const DATA_NOT_AVAILABLE = "—";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseInvoiceSnapshotDueDate(snapshot: unknown): string | null {
  const details = asRecord(asRecord(snapshot)?.details);
  const raw = details?.maturity_date;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
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

export function selectComparisonYears(yearKeys: string[]): string[] {
  const years = yearKeys
    .filter((key) => /^\d{4}$/.test(key))
    .map(Number)
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => b - a)
    .slice(0, 3)
    .sort((a, b) => a - b);
  return years.map(String);
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
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — PAT Margin (never profit_margin / PBT).
      return formatPercentFromPoints(
        resolveCtosPatMarginPercent({
          plnpat: parseMoney(raw.plnpat),
          turnover: parseMoney(raw.turnover),
        })
      );
    }
    case "roe": {
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — direct r:return_on_equity only.
      return formatPercentFromPoints(
        resolveCtosReturnOnEquityPercent({
          return_on_equity: parseMoney(raw.return_on_equity),
        })
      );
    }
    case "currentRatio": {
      // CTOS ENQWS v5.11.0 Financial Highlights XSL — direct r:currat only.
      return formatMultiple(
        resolveCtosCurrentRatio({
          currat: parseMoney(raw.currat),
        })
      );
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

const PAGE_TWO_METRICS: Array<{
  label: string;
  key: Parameters<typeof metricForYear>[0];
}> = [
  { label: "Revenue", key: "revenue" },
  { label: "Profit After Tax (RM mil.)", key: "profitAfterTax" },
  { label: "Net Profit Margin (%)", key: "netProfitMargin" },
  { label: "ROE (%)", key: "roe" },
  { label: "Current Ratio (x)", key: "currentRatio" },
  { label: "Net Debt / Equity (x)", key: "netDebtEquity" },
  { label: "Interest Coverage (x)", key: "interestCoverage" },
  { label: "DSCR (x)", key: "dscr" },
  { label: "Receivables Days", key: "receivablesDays" },
];

/** Unsupported Page 2 metrics that officers may fill per displayed year. */
export const PAGE_TWO_OFFICER_FINANCIAL_METRICS = [
  { key: "netDebtEquity", label: "Net Debt / Equity (x)", unit: "x" },
  { key: "interestCoverage", label: "Interest Coverage (x)", unit: "x" },
  { key: "dscr", label: "DSCR (x)", unit: "x" },
  { key: "receivablesDays", label: "Receivables Days", unit: "days" },
] as const;

type OfficerFinancialOverrideKey = (typeof PAGE_TWO_OFFICER_FINANCIAL_METRICS)[number]["key"];

/**
 * Live Admin preview merge for officer financial overrides.
 * Presentation only — does not invent system formulas or gearing substitution.
 */
export function mergeOfficerOverridesIntoFinancialTable(
  table: FinancialMetricTableModel & { sourceFooter?: string },
  overrides:
    | Record<
        string,
        Partial<Record<OfficerFinancialOverrideKey, string | number | null | undefined>>
      >
    | null
    | undefined
): FinancialMetricTableModel & { sourceFooter?: string } {
  if (!overrides) return table;
  const labelToKey = new Map<string, OfficerFinancialOverrideKey>(
    PAGE_TWO_OFFICER_FINANCIAL_METRICS.map((m) => [m.label, m.key])
  );
  return {
    ...table,
    rows: table.rows.map((row) => {
      const key = labelToKey.get(row.metric);
      if (!key) return row;
      return {
        ...row,
        values: table.yearHeaders.map((header, index) => {
          // Prefer stable FYE ISO key; accept legacy calendar-year keys.
          const yearOverride =
            overrides[header.key] ??
            overrides[header.key.slice(0, 4)] ??
            overrides[`${header.key.slice(0, 4)}-12-31`];
          const raw = yearOverride?.[key];
          const n =
            typeof raw === "number" && Number.isFinite(raw)
              ? raw
              : typeof raw === "string" && raw.trim() !== ""
                ? Number(raw.replace(/,/g, ""))
                : null;
          if (n == null || !Number.isFinite(n)) return row.values[index] ?? DATA_NOT_AVAILABLE;
          if (key === "receivablesDays") {
            if (!Number.isInteger(n)) return row.values[index] ?? DATA_NOT_AVAILABLE;
            return String(Math.trunc(n));
          }
          return formatMultiple(n);
        }),
      };
    }),
  };
}

/**
 * @deprecated Admin Invoice & Paymaster must use API `invoicePaymaster.rows`
 * (same Page 2 Stage 2 builder as Preview). Kept only for legacy test helpers.
 */
export function buildInvoicePaymasterVerificationRows(note: NoteDetail): CoreTermRow[] {
  const paymaster = asRecord(note.paymasterSnapshot);
  const faceValue = parseInvoiceSnapshotFaceValue(note.invoiceSnapshot);
  return [
    { label: "Invoice Amount", value: formatMoneyOrDna(faceValue) },
    { label: "Invoice Due Date", value: formatDateUtc(parseInvoiceSnapshotDueDate(note.invoiceSnapshot)) },
    { label: "Paymaster", value: textOrDna(note.paymasterName ?? paymaster?.name) },
    {
      label: "Nature of Paymaster",
      value: textOrDna(paymaster?.entity_type ?? paymaster?.entityType),
    },
    { label: "Deed of Assignment (DOA)", value: DATA_NOT_AVAILABLE },
    { label: "Paymaster Rating", value: DATA_NOT_AVAILABLE },
    { label: "Confidence Grading", value: DATA_NOT_AVAILABLE },
  ];
}

/**
 * Compact 3-year financial comparison table using Application unaudited years.
 * Same supported helpers as Page 2; unsupported rows stay —.
 */
export function buildPageTwoFinancialComparisonTable(
  financialStatements: unknown
): FinancialMetricTableModel {
  const root = asRecord(financialStatements);
  const unaudited = asRecord(root?.unaudited_by_year) ?? {};
  const years = selectComparisonYears(Object.keys(unaudited));
  const fyeIso = readFinancialYearEndIso(financialStatements);
  const byYear: Record<string, Record<string, unknown>> = {};
  for (const year of years) {
    byYear[year] = asRecord(unaudited[year]) ?? {};
  }

  return {
    yearHeaders: years.map((year) => ({
      key: year,
      yearLabel: `FY${year}`,
      fyeLabel: formatFyeLabel(fyeIso, year),
    })),
    rows: PAGE_TWO_METRICS.map(({ label, key }) => ({
      metric: label,
      values: years.map((year) => metricForYear(key, byYear[year] ?? {})),
    })),
  };
}

/** @deprecated Prefer buildPageTwoFinancialComparisonTable for admin display. */
export function buildPageTwoFinancialComparisonRows(
  financialStatements: unknown
): CoreTermRow[] {
  const table = buildPageTwoFinancialComparisonTable(financialStatements);
  if (table.yearHeaders.length === 0) {
    return PAGE_TWO_METRICS.map(({ label }) => ({
      label,
      value: DATA_NOT_AVAILABLE,
    }));
  }
  return table.rows.map((row) => ({
    label: row.metric,
    value: table.yearHeaders
      .map((header, index) => `${header.yearLabel}: ${row.values[index] ?? DATA_NOT_AVAILABLE}`)
      .join(" · "),
  }));
}

export function pageTwoCoverageHidesIssuerIdentity(rows: CoreTermRow[]): boolean {
  const joined = rows.map((r) => `${r.label} ${r.value}`).join("\n");
  return !/registration|ssm|company name/i.test(joined);
}
