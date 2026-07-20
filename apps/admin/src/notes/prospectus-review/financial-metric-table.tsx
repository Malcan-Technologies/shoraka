"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FinancialYearHeader = {
  key: string;
  yearLabel: string;
  fyeLabel: string;
};

export type FinancialMetricTableRow = {
  metric: string;
  values: string[];
  trend?: string;
};

export type FinancialMetricTableModel = {
  yearHeaders: FinancialYearHeader[];
  rows: FinancialMetricTableRow[];
  /** Optional Page 2 financial comparison source footer. */
  sourceFooter?: string;
};

type Props = {
  table: FinancialMetricTableModel;
  /** When true, show the 3-Year Trend column (Page 3 coverage table). */
  showTrend?: boolean;
};

/** Compact multi-year financial metric table for Prospectus Review. */
export function ProspectusFinancialMetricTable({ table, showTrend = false }: Props) {
  const colCount = 1 + table.yearHeaders.length + (showTrend ? 1 : 0);

  return (
    <div className="min-w-0 max-w-full space-y-0 overflow-x-auto rounded-xl border">
      <Table className="min-w-[36rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[10rem] whitespace-nowrap text-sm font-semibold text-foreground">
              Financial Metric
            </TableHead>
            {table.yearHeaders.map((header) => (
              <TableHead
                key={header.key}
                className="min-w-[7.5rem] whitespace-nowrap text-sm font-semibold text-foreground"
              >
                <div>{header.yearLabel}</div>
                <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {header.fyeLabel}
                </div>
              </TableHead>
            ))}
            {showTrend ? (
              <TableHead className="min-w-[7rem] whitespace-nowrap text-sm font-semibold text-foreground">
                3-Year Trend
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="py-8 text-center text-muted-foreground">
                Data not available
              </TableCell>
            </TableRow>
          ) : (
            table.rows.map((row) => (
              <TableRow key={row.metric}>
                <TableCell className="whitespace-nowrap text-sm font-medium text-foreground">
                  {row.metric}
                </TableCell>
                {row.values.map((value, index) => (
                  <TableCell
                    key={`${row.metric}-${table.yearHeaders[index]?.key ?? index}`}
                    className="whitespace-nowrap text-sm text-foreground"
                  >
                    {value}
                  </TableCell>
                ))}
                {showTrend ? (
                  <TableCell className="whitespace-nowrap text-sm text-foreground">
                    {row.trend ?? "Data not available"}
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {table.sourceFooter ? (
        <p className="border-t px-4 py-2 text-sm text-muted-foreground">{table.sourceFooter}</p>
      ) : null}
    </div>
  );
}
