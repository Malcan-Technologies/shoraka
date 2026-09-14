import {
  formatReportAsOfChip,
  formatReportRangeChip,
  isReportCategoryKey,
  REPORT_BREAKDOWN_LABELS,
  resolveReportAsOfPreset,
  resolveReportRangePreset,
  todayMytYmd,
  type ReportBreakdown,
  type ReportCategoryKey,
  type ReportDefinition,
  type ReportQuery,
} from "@cashsouk/types";

export function reportsTabFromSearch(value: string | null | undefined): ReportCategoryKey {
  if (value && isReportCategoryKey(value)) return value;
  return "credit_quality";
}

export function reportsCatalogHref(category: ReportCategoryKey = "credit_quality"): string {
  return `/reports?tab=${category}`;
}

export function reportFilterKind(definition: ReportDefinition): "range" | "asOf" | "none" {
  if (definition.filters.includes("from") || definition.filters.includes("to")) return "range";
  if (definition.filters.includes("asOf")) return "asOf";
  return "none";
}

export function defaultReportQuery(definition: ReportDefinition, now = new Date()): ReportQuery {
  const query: ReportQuery = {};
  if (reportFilterKind(definition) === "asOf") {
    query.asOf = resolveReportAsOfPreset("today", now);
  }
  if (reportFilterKind(definition) === "range") {
    const range = resolveReportRangePreset("this_month", now);
    query.from = range.from;
    query.to = range.to;
  }
  if (definition.breakdownOptions?.length) {
    query.groupBy = "start_month";
  }
  return query;
}

export function isDefaultPeriodQuery(
  definition: ReportDefinition,
  query: ReportQuery,
  now = new Date()
): boolean {
  const defaults = defaultReportQuery(definition, now);
  return query.asOf === defaults.asOf && query.from === defaults.from && query.to === defaults.to;
}

export function validateCustomRange(from: string, to: string, today = todayMytYmd()): string | null {
  if (!from || !to) return "Choose both From and To.";
  if (from > to) return "From must be on or before To.";
  if (from > today || to > today) return "Dates cannot be after today.";
  return null;
}

export function validateCustomAsOf(asOf: string, today = todayMytYmd()): string | null {
  if (!asOf) return "Choose an as-of date.";
  if (asOf > today) return "As of cannot be after today.";
  return null;
}

export function reportPeriodChipLabel(query: ReportQuery, now = new Date()): string | null {
  if (query.from && query.to) return formatReportRangeChip(query.from, query.to, now);
  if (query.asOf) return formatReportAsOfChip(query.asOf, now);
  return null;
}

export function reportBreakdownChipLabel(groupBy?: ReportBreakdown): string | null {
  if (!groupBy) return null;
  return `Breakdown: ${REPORT_BREAKDOWN_LABELS[groupBy]}`;
}
