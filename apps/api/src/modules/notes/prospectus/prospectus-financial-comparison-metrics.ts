/**
 * SECTION: Build Page 2 financial comparison metrics (Stage 4B)
 * WHY: Consume Stage 4A years; reuse shared calculators; officer fills for unsupported rows
 */

import {
  resolveApplicationFinancialCurrentRatio,
  resolveApplicationFinancialProfitMarginRatio,
  resolveApplicationFinancialReturnOnEquityRatio,
} from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS,
  PROSPECTUS_FINANCIAL_COMPARISON_METRIC_LABELS,
  PROSPECTUS_FINANCIAL_COMPARISON_METRICS_AUDIT,
  type ProspectusFinancialComparisonMetricKey,
  type ProspectusFinancialComparisonMetricRow,
  type ProspectusFinancialComparisonMetrics,
  type ProspectusFinancialComparisonMetricsInput,
  type ProspectusFinancialComparisonYearOfficerOverride,
} from "./prospectus-financial-comparison-metrics.types";
import type { ProspectusFinancialComparisonYear } from "./prospectus-financial-comparison-source.types";

/**
 * Parse a stored financial scalar.
 * Absent / empty / invalid → null (DNA).
 * Explicit 0 is a real stored value.
 */
export function parseProspectusFinancialNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Display-only MYR millions for Revenue / PAT.
 * Full MYR remains in source and formulas; divide by 1e6 only here.
 * Up to one decimal; trim trailing `.0`. Non-zero amounts must not collapse to `0`.
 */
export function formatProspectusMyrMillions(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return PROSPECTUS_DATA_NOT_AVAILABLE;
  if (amount === 0) return "0";

  const millions = amount / 1_000_000;
  const oneDp = millions.toFixed(1);
  const trimmedOne = oneDp.replace(/\.0$/, "");
  if (Number(trimmedOne) !== 0) return trimmedOne;

  // Non-zero full MYR rounded away at 1dp — keep enough precision without toFixed rounding up.
  const precise = millions.toFixed(10).replace(/\.?0+$/, "");
  if (precise !== "" && Number(precise) !== 0) return precise;
  return millions < 0 ? ">-0.000001" : "<0.000001";
}

/**
 * Shared helper returns a ratio (e.g. 0.086). Display as percent points.
 * Up to 2 decimals; trim trailing zeros.
 */
export function formatProspectusFinancialPercentFromRatio(
  ratio: number | null | undefined
): string {
  if (ratio == null || !Number.isFinite(ratio)) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const percent = ratio * 100;
  const fixed = percent.toFixed(2).replace(/\.?0+$/, "");
  return `${fixed}%`;
}

/** Current ratio / coverage multiple — up to 2 decimals, trim trailing zeros, lowercase x. */
export function formatProspectusFinancialMultiple(
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(value)) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const fixed = value.toFixed(2).replace(/\.?0+$/, "");
  return `${fixed}x`;
}

function formatReceivablesDays(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return String(Math.trunc(value));
}

function fieldFromRaw(raw: Record<string, unknown>, key: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(raw, key)) return null;
  return parseProspectusFinancialNumber(raw[key]);
}

/**
 * Resolve officer overrides by stable FYE ISO first, then legacy year keys.
 * Never maps a hidden-year override onto a different displayed column.
 */
export function resolveYearOverride(
  year: ProspectusFinancialComparisonYear,
  overrides: ProspectusFinancialComparisonMetricsInput["officerOverrides"]
): ProspectusFinancialComparisonYearOfficerOverride | null {
  if (!overrides) return null;
  const fyeKey = year.financialYearEndIso;
  if (fyeKey && overrides[fyeKey]) return overrides[fyeKey] ?? null;

  const yearKey = String(year.year);
  if (overrides[yearKey]) return overrides[yearKey] ?? null;

  const decemberKey = `${year.year}-12-31`;
  if (overrides[decemberKey]) return overrides[decemberKey] ?? null;

  return null;
}

function officerMetricValue(
  key: ProspectusFinancialComparisonMetricKey,
  override: ProspectusFinancialComparisonYearOfficerOverride | null
): string | null {
  if (!override) return null;
  switch (key) {
    case "netDebtEquity": {
      const n = parseProspectusFinancialNumber(override.netDebtEquity);
      return n == null ? null : formatProspectusFinancialMultiple(n);
    }
    case "interestCoverage": {
      const n = parseProspectusFinancialNumber(override.interestCoverage);
      return n == null ? null : formatProspectusFinancialMultiple(n);
    }
    case "dscr": {
      const n = parseProspectusFinancialNumber(override.dscr);
      return n == null ? null : formatProspectusFinancialMultiple(n);
    }
    case "receivablesDays": {
      const n = parseProspectusFinancialNumber(override.receivablesDays);
      if (n == null) return null;
      if (!Number.isInteger(n)) return null;
      return formatReceivablesDays(n);
    }
    default:
      return null;
  }
}

function metricValueForYear(
  key: ProspectusFinancialComparisonMetricKey,
  raw: Record<string, unknown>,
  override: ProspectusFinancialComparisonYearOfficerOverride | null
): string {
  switch (key) {
    case "revenue": {
      const turnover = fieldFromRaw(raw, "turnover");
      return formatProspectusMyrMillions(turnover);
    }
    case "profitAfterTax": {
      const plnpat = fieldFromRaw(raw, "plnpat");
      return formatProspectusMyrMillions(plnpat);
    }
    case "netProfitMargin": {
      return formatProspectusFinancialPercentFromRatio(
        resolveApplicationFinancialProfitMarginRatio({
          profit_margin: fieldFromRaw(raw, "profit_margin"),
          plnpat: fieldFromRaw(raw, "plnpat"),
          turnover: fieldFromRaw(raw, "turnover"),
        })
      );
    }
    case "roe": {
      return formatProspectusFinancialPercentFromRatio(
        resolveApplicationFinancialReturnOnEquityRatio({
          return_on_equity: fieldFromRaw(raw, "return_on_equity"),
          plnpat: fieldFromRaw(raw, "plnpat"),
          bsqpuc: fieldFromRaw(raw, "bsqpuc"),
        })
      );
    }
    case "currentRatio": {
      return formatProspectusFinancialMultiple(
        resolveApplicationFinancialCurrentRatio({
          currat: fieldFromRaw(raw, "currat"),
          bscatot: fieldFromRaw(raw, "bscatot"),
          curlib: fieldFromRaw(raw, "curlib"),
        })
      );
    }
    case "netDebtEquity":
    case "interestCoverage":
    case "dscr":
    case "receivablesDays": {
      const officer = officerMetricValue(key, override);
      return officer ?? PROSPECTUS_DATA_NOT_AVAILABLE;
    }
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function buildProspectusFinancialComparisonMetrics(
  input: ProspectusFinancialComparisonMetricsInput
): ProspectusFinancialComparisonMetrics {
  // CTOS is consumed only via Stage 4A normalized years — never re-mixed here.
  void input.ctosFinancials;

  const { source } = input;
  const rows: ProspectusFinancialComparisonMetricRow[] =
    PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS.map((key) => ({
      key,
      label: PROSPECTUS_FINANCIAL_COMPARISON_METRIC_LABELS[key],
      values: source.years.map((year) =>
        metricValueForYear(key, year.rawFinancials, resolveYearOverride(year, input.officerOverrides))
      ),
    }));

  return {
    sectionHeading: source.sectionHeading,
    tableUnitLabel: source.tableUnitLabel,
    sourceFooter: source.sourceFooter,
    years: source.years,
    rows,
    audit: PROSPECTUS_FINANCIAL_COMPARISON_METRICS_AUDIT,
  };
}

/**
 * Admin Prospectus Review table — same labels/values as Page 2 Canva HTML.
 * Maps an already-built Stage 4B view-model; does not re-derive metrics.
 * yearHeaders.key is the stable FYE ISO override key.
 */
export function toAdminFinancialComparisonTable(
  metrics: ProspectusFinancialComparisonMetrics
): {
  yearHeaders: Array<{ key: string; yearLabel: string; fyeLabel: string }>;
  rows: Array<{ metric: string; values: string[] }>;
  sourceFooter: string;
} {
  return {
    yearHeaders: metrics.years.map((year) => ({
      key: year.financialYearEndIso,
      yearLabel: year.yearLabel,
      fyeLabel: year.financialYearEndLabel,
    })),
    rows: metrics.rows.map((row) => ({
      metric: row.label,
      values: [...row.values],
    })),
    sourceFooter: metrics.sourceFooter,
  };
}
