import { formatCurrency } from "@cashsouk/config";
import type {
  FinancialReviewCalculatedKey,
  NoteDetail,
  ProspectusFrozenFinancialYear,
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

type PageTwoYearValues = Pick<ProspectusFrozenFinancialYear, "raw" | "calculated">;

/** Stored calculated metric from the approved Financial result (never recalculated here). */
function calculatedValue(year: PageTwoYearValues, key: FinancialReviewCalculatedKey): number | null {
  const value = year.calculated?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  year: PageTwoYearValues
): string {
  switch (key) {
    case "revenue":
      return formatMoneyOrDna(parseMoney(year.raw.turnover));
    case "profitAfterTax":
      return formatMoneyOrDna(parseMoney(year.raw.plnpat));
    case "netProfitMargin":
      // Stored PAT Margin (never CTOS profit_margin / PBT).
      return formatPercentFromPoints(calculatedValue(year, "profit_margin"));
    case "roe":
      return formatPercentFromPoints(calculatedValue(year, "return_on_equity"));
    case "currentRatio":
      return formatMultiple(calculatedValue(year, "currat"));
    case "netDebtEquity":
    case "interestCoverage":
    case "dscr":
    case "receivablesDays":
      if (key === "receivablesDays") {
        const days = calculatedValue(year, "receivablesDays");
        return days == null ? DATA_NOT_AVAILABLE : String(Math.trunc(days));
      }
      return formatMultiple(calculatedValue(year, key));
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
  // These metrics are now system-derived from Stage 4A raw fields.
  // Ignore legacy/entered override values so they never replace canonical calculations.
  return table;
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
  ];
}

/**
 * Compact 3-year financial comparison table from the frozen Prospectus years.
 * Raw rows read `raw`; calculated rows read the stored `calculated` values; missing stays —.
 */
export function buildPageTwoFinancialComparisonTable(
  frozenYears: ProspectusFrozenFinancialYear[]
): FinancialMetricTableModel {

  const calculatedKeys = new Set<Parameters<typeof metricForYear>[0]>([
    "roe",
    "currentRatio",
    "netDebtEquity",
    "interestCoverage",
    "dscr",
    "receivablesDays",
  ]);

  return {
    yearHeaders: frozenYears.map((year) => ({
      key: String(year.calendarYear),
      yearLabel: year.label,
      fyeLabel: year.fyeLabel,
    })),
    rows: PAGE_TWO_METRICS.map(({ label, key }) => {
      const values: string[] = [];
      const cellHints: Array<string | null> = [];

      for (const year of frozenYears) {
        // Display-only placeholder column — never resolve metrics.
        const rawValue = year.isPlaceholder ? DATA_NOT_AVAILABLE : metricForYear(key, year);
        const isCalculatedMissing = calculatedKeys.has(key) && rawValue === DATA_NOT_AVAILABLE;

        if (isCalculatedMissing) {
          values.push(DATA_NOT_AVAILABLE);
          cellHints.push(null);
        } else {
          values.push(rawValue);
          cellHints.push(null);
        }
      }

      return { metric: label, values, cellHints };
    }),
  };
}

/** @deprecated Prefer buildPageTwoFinancialComparisonTable for admin display. */
export function buildPageTwoFinancialComparisonRows(
  frozenYears: ProspectusFrozenFinancialYear[]
): CoreTermRow[] {
  const table = buildPageTwoFinancialComparisonTable(frozenYears);
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
