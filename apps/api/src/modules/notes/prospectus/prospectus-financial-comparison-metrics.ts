/**
 * SECTION: Build Page 2 financial comparison metrics (Stage 4B)
 * WHY: Consume Stage 4A years; reuse shared calculators; unsupported rows stay DNA
 */

import {
  calculateCurrentRatio,
  calculateProfitMargin,
  calculateReturnOnEquity,
} from "@cashsouk/types";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS,
  PROSPECTUS_FINANCIAL_COMPARISON_METRIC_LABELS,
  PROSPECTUS_FINANCIAL_COMPARISON_METRICS_AUDIT,
  type ProspectusFinancialComparisonMetricKey,
  type ProspectusFinancialComparisonMetricRow,
  type ProspectusFinancialComparisonMetrics,
  type ProspectusFinancialComparisonMetricsInput,
} from "./prospectus-financial-comparison-metrics.types";

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

/** Current ratio multiple — up to 2 decimals, trim trailing zeros, lowercase x. */
export function formatProspectusFinancialMultiple(
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(value)) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const fixed = value.toFixed(2).replace(/\.?0+$/, "");
  return `${fixed}x`;
}

function fieldFromRaw(
  raw: Record<string, unknown>,
  key: string
): number | null {
  if (!Object.prototype.hasOwnProperty.call(raw, key)) return null;
  return parseProspectusFinancialNumber(raw[key]);
}

function metricValueForYear(
  key: ProspectusFinancialComparisonMetricKey,
  raw: Record<string, unknown>
): string {
  switch (key) {
    case "revenue": {
      const turnover = fieldFromRaw(raw, "turnover");
      return formatProspectusMoneyMyr(turnover);
    }
    case "profitAfterTax": {
      const plnpat = fieldFromRaw(raw, "plnpat");
      return formatProspectusMoneyMyr(plnpat);
    }
    case "netProfitMargin": {
      const plnpat = fieldFromRaw(raw, "plnpat");
      const turnover = fieldFromRaw(raw, "turnover");
      if (plnpat == null || turnover == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
      return formatProspectusFinancialPercentFromRatio(
        calculateProfitMargin(plnpat, turnover)
      );
    }
    case "roe": {
      const plnpat = fieldFromRaw(raw, "plnpat");
      const bsqpuc = fieldFromRaw(raw, "bsqpuc");
      if (plnpat == null || bsqpuc == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
      return formatProspectusFinancialPercentFromRatio(
        calculateReturnOnEquity(plnpat, bsqpuc)
      );
    }
    case "currentRatio": {
      const bscatot = fieldFromRaw(raw, "bscatot");
      const curlib = fieldFromRaw(raw, "curlib");
      if (bscatot == null || curlib == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
      return formatProspectusFinancialMultiple(calculateCurrentRatio(bscatot, curlib));
    }
    case "netDebtEquity":
    case "interestCoverage":
    case "dscr":
    case "receivablesDays":
      return PROSPECTUS_DATA_NOT_AVAILABLE;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function buildProspectusFinancialComparisonMetrics(
  input: ProspectusFinancialComparisonMetricsInput
): ProspectusFinancialComparisonMetrics {
  void input.ctosFinancials;

  const { source } = input;
  const rows: ProspectusFinancialComparisonMetricRow[] =
    PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS.map((key) => ({
      key,
      label: PROSPECTUS_FINANCIAL_COMPARISON_METRIC_LABELS[key],
      values: source.years.map((year) => metricValueForYear(key, year.rawFinancials)),
    }));

  return {
    sectionHeading: source.sectionHeading,
    tableUnitLabel: source.tableUnitLabel,
    years: source.years,
    rows,
    sourceNote: source.sourceNote,
    audit: PROSPECTUS_FINANCIAL_COMPARISON_METRICS_AUDIT,
  };
}
