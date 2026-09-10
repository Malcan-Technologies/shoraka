import type { ReportSummaryRow } from "@cashsouk/types";

export type ReportSummaryPresentation = {
  primary: { kind: "amount"; value: number } | { kind: "count"; value: number } | { kind: "percent"; value: number };
  secondary: Array<{ kind: "count"; value: number } | { kind: "percent"; value: number }>;
};

export function presentReportSummary(summary: ReportSummaryRow): ReportSummaryPresentation | null {
  if (summary.amount != null) {
    return {
      primary: { kind: "amount", value: summary.amount },
      secondary: [
        summary.count != null ? { kind: "count" as const, value: summary.count } : null,
        percentLine(summary.percent),
      ].filter((value): value is { kind: "count"; value: number } | { kind: "percent"; value: number } =>
        Boolean(value)
      ),
    };
  }
  if (summary.count != null) {
    return {
      primary: { kind: "count", value: summary.count },
      secondary: [percentLine(summary.percent)].filter(
        (value): value is { kind: "percent"; value: number } => Boolean(value)
      ),
    };
  }
  if (summary.percent != null) {
    return { primary: { kind: "percent", value: summary.percent }, secondary: [] };
  }
  return null;
}

function percentLine(value: number | undefined): { kind: "percent"; value: number } | null {
  if (value == null) return null;
  return { kind: "percent", value };
}
