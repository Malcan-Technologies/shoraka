"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { REPORT_KEYS, REPORT_REGISTRY, type ReportColumn, type ReportKey, type ReportQuery } from "@cashsouk/types";
import { formatCurrency } from "@cashsouk/config";
import { Card, CardContent, Skeleton, StatusBadge } from "@cashsouk/ui";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PortfolioAtRiskRow } from "@/components/portfolio-at-risk-row";
import { RequirePermission } from "@/components/require-permission";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportPeriodFilters } from "@/reports/components/report-period-filters";
import { useAdminReport, useDownloadAdminReport } from "@/reports/hooks/use-reports";
import { presentReportSummary } from "@/reports/utils/report-summary-presentation";
import { formatReportTableDate, presentReportCell } from "@/reports/utils/report-table-presentation";
import { defaultReportQuery, reportsCatalogHref } from "@/reports/utils/report-period-filters";

function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

function formatSummaryValue(
  value: { kind: "amount"; value: number } | { kind: "count"; value: number } | { kind: "percent"; value: number }
) {
  if (value.kind === "amount") return formatCurrency(value.value);
  if (value.kind === "percent") return `${value.value.toFixed(1)}%`;
  return String(value.value);
}

function formatCell(
  value: string | number | boolean | null,
  kind: "text" | "number" | "money" | "percent" | "date" | "boolean"
) {
  if (value == null || value === "") return "—";
  if (kind === "boolean") return value ? "Yes" : "No";
  if (kind === "percent") {
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(amount)) return String(value);
    return `${amount.toFixed(1)}%`;
  }
  if (kind === "money") {
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(amount)) return String(value);
    return formatCurrency(amount);
  }
  if (kind === "number") {
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(amount)) return String(value);
    return String(amount);
  }
  if (kind === "date") {
    return formatReportTableDate(value);
  }
  return String(value);
}

function ReportTableCell({
  column,
  row,
}: {
  column: ReportColumn;
  row: Record<string, string | number | boolean | null>;
}) {
  const badge = presentReportCell(column, row);
  if (badge) {
    const chip = <StatusBadge label={badge.label} status={badge.token} />;
    if (badge.href) {
      return (
        <Link
          href={badge.href}
          className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {chip}
        </Link>
      );
    }
    return chip;
  }
  return formatCell(row[column.key] ?? null, column.kind);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function reportContextNote(key: ReportKey): string | null {
  if (key === "investor_book") {
    return "Holdings columns are current. Cash movement and realised returns use the selected period.";
  }
  if (key === "trust_revenue") {
    return "Summary lines explain movements already included in bucket totals. Do not add them to opening or closing balances.";
  }
  return null;
}

export default function ReportDetailPage() {
  const params = useParams<{ reportKey: string }>();
  const reportKey = params.reportKey;
  const definition = REPORT_REGISTRY.find((item) => item.key === reportKey);
  const valid = isReportKey(reportKey) && definition != null && definition.available;
  const [query, setQuery] = React.useState<ReportQuery>(() =>
    definition ? defaultReportQuery(definition) : {}
  );

  React.useEffect(() => {
    if (!definition) return;
    setQuery(defaultReportQuery(definition));
  }, [definition, reportKey]);

  const report = useAdminReport(valid ? (reportKey as ReportKey) : "ageing", query, valid);
  const download = useDownloadAdminReport();

  const handleExport = async (format: "csv" | "xlsx") => {
    if (!valid) return;
    try {
      const blob = await download.mutateAsync({
        key: reportKey as ReportKey,
        params: query,
        format,
      });
      downloadBlob(blob, `${reportKey}.${format}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  const backHref = reportsCatalogHref(definition?.category ?? "credit_quality");

  if (!valid || !definition) {
    return (
      <RequirePermission permission="reports.view">
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="w-full space-y-6 px-2 py-8 md:px-4">
            <AdminPageHeader title="Report not available" description="This report is not available yet." />
            <Button asChild variant="outline">
              <Link href={backHref}>Back to reports</Link>
            </Button>
          </div>
        </div>
      </RequirePermission>
    );
  }

  const contextNote = reportContextNote(definition.key);
  const exportButtons = (
    <>
      <Button variant="outline" onClick={() => void handleExport("csv")} disabled={download.isPending}>
        <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" />
        Export CSV
      </Button>
      <Button variant="outline" onClick={() => void handleExport("xlsx")} disabled={download.isPending}>
        <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" />
        Export XLSX
      </Button>
    </>
  );

  return (
    <RequirePermission permission="reports.view">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <AdminPageHeader
            title={definition.title}
            description={definition.description}
            action={
              <Button asChild variant="outline">
                <Link href={backHref}>Back to reports</Link>
              </Button>
            }
          />
          {contextNote ? <p className="text-ui text-muted-foreground">{contextNote}</p> : null}

          {definition.filters.length > 0 ? (
            <ReportPeriodFilters
              definition={definition}
              query={query}
              onQueryChange={setQuery}
              onReload={() => void report.refetch()}
              isLoading={report.isFetching}
              rowCount={report.data?.rows.length}
            >
              {exportButtons}
            </ReportPeriodFilters>
          ) : (
            <div className="flex flex-wrap gap-2">{exportButtons}</div>
          )}

          {report.error ? (
            <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
              {report.error instanceof Error ? report.error.message : "Failed to load report"}
            </div>
          ) : null}

          {report.data?.portfolioAtRisk ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Portfolio at risk</p>
              <p className="text-meta text-muted-foreground">
                PAR30, PAR60 and PAR90 are cumulative: each includes every note with DPD above that
                threshold. Defaulted is the servicing mark, not a DPD band.
              </p>
              <PortfolioAtRiskRow
                summary={report.data.portfolioAtRisk}
                loading={report.isLoading}
              />
            </div>
          ) : null}

          {definition.key !== "ageing" && report.data?.summaries?.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {report.data.summaries.map((summary) => {
                const presented = presentReportSummary(summary);
                if (!presented) return null;
                return (
                  <Card key={summary.label} className="rounded-2xl shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">{summary.label}</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">
                        {formatSummaryValue(presented.primary)}
                      </p>
                      {presented.secondary.map((line) => (
                        <p
                          key={`${line.kind}-${line.value}`}
                          className="mt-1 text-meta text-muted-foreground tabular-nums"
                        >
                          {formatSummaryValue(line)}
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {definition.columns.map((column) => (
                      <TableHead key={column.key} className="whitespace-nowrap">
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        {definition.columns.map((column) => (
                          <TableCell key={column.key}>
                            <Skeleton className="h-5 w-24" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : report.data?.emptyReason ? (
                    <TableRow>
                      <TableCell
                        colSpan={Math.max(definition.columns.length, 1)}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {report.data.emptyReason}
                      </TableCell>
                    </TableRow>
                  ) : (report.data?.rows.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Math.max(definition.columns.length, 1)}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No rows for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.data?.rows.map((row, index) => (
                      <TableRow key={index}>
                        {definition.columns.map((column) => (
                          <TableCell key={column.key} className="whitespace-nowrap tabular-nums">
                            <ReportTableCell column={column} row={row} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
