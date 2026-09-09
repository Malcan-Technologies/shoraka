import ExcelJS from "exceljs";
import type { ReportResult } from "@cashsouk/types";
import { portfolioAtRiskSummaryRows } from "./par-summary";

function cellValue(value: string | number | boolean | null): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function neutralizeSpreadsheetFormula(value: string): string {
  if (value === "") return value;
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

export function buildReportCsv(result: ReportResult): string {
  const headers = [...result.columns.map((column) => column.label)];
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of result.rows) {
    lines.push(result.columns.map((column) => csvEscape(cellValue(row[column.key] ?? null))).join(","));
  }
  const extra = result.portfolioAtRisk
    ? portfolioAtRiskSummaryRows(result.portfolioAtRisk)
    : [];
  const summaries = [...result.summaries, ...extra];
  if (summaries.length > 0) {
    lines.push("");
    lines.push(["Summary", "Count", "Amount", "Percent"].map(csvEscape).join(","));
    for (const summary of summaries) {
      lines.push(
        [
          csvEscape(summary.label),
          csvEscape(summary.count == null ? "" : String(summary.count)),
          csvEscape(summary.amount == null ? "" : String(summary.amount)),
          csvEscape(summary.percent == null ? "" : String(summary.percent)),
        ].join(",")
      );
    }
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  const safe = neutralizeSpreadsheetFormula(value);
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export async function buildReportXlsx(result: ReportResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(result.title.slice(0, 31));
  sheet.addRow(result.columns.map((column) => column.label));
  for (const row of result.rows) {
    sheet.addRow(
      result.columns.map((column) => {
        const value = row[column.key] ?? null;
        return typeof value === "string" ? neutralizeSpreadsheetFormula(value) : value;
      })
    );
  }
  const extra = result.portfolioAtRisk
    ? portfolioAtRiskSummaryRows(result.portfolioAtRisk)
    : [];
  const summaries = [...result.summaries, ...extra];
  if (summaries.length > 0) {
    sheet.addRow([]);
    sheet.addRow(["Summary", "Count", "Amount", "Percent"]);
    for (const summary of summaries) {
      sheet.addRow([summary.label, summary.count ?? null, summary.amount ?? null, summary.percent ?? null]);
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function reportDownloadName(result: ReportResult, format: "csv" | "xlsx"): string {
  const stamp = (result.asOf ?? result.to ?? result.generatedAt.slice(0, 10)).replace(/[^\d-]/g, "");
  return `${result.key}-${stamp}.${format}`;
}
