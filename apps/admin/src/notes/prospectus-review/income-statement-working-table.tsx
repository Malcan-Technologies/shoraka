"use client";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FinancialMetricTableModel } from "./financial-metric-table";

const OFFICER_METRICS = new Set(["Gross Profit", "EBITDA", "EBIT"]);

const METRIC_TO_FIELD: Record<string, string> = {
  "Gross Profit": "grossProfit",
  EBITDA: "ebitda",
  EBIT: "ebit",
};

type Props = {
  table: FinancialMetricTableModel;
  years: readonly string[];
  manualYears: Record<string, Record<string, string | number | null | undefined> | undefined>;
  disabled: boolean;
  onChange: (year: string, field: string, value: string) => void;
};

/**
 * One Income Statement table for all selected years.
 * System rows stay read-only; Gross Profit / EBITDA / EBIT are officer inputs.
 */
export function ProspectusIncomeStatementWorkingTable({
  table,
  years,
  manualYears,
  disabled,
  onChange,
}: Props) {
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
                className="min-w-[8rem] whitespace-nowrap text-sm font-semibold text-foreground"
              >
                <div>{header.yearLabel}</div>
                <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {header.fyeLabel}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={1 + table.yearHeaders.length}
                className="py-8 text-center text-muted-foreground"
              >
                Data not available
              </TableCell>
            </TableRow>
          ) : (
            table.rows.map((row) => {
              const isOfficer = OFFICER_METRICS.has(row.metric);
              const field = METRIC_TO_FIELD[row.metric];
              return (
                <TableRow key={row.metric}>
                  <TableCell className="whitespace-nowrap text-sm font-medium text-foreground">
                    {row.metric}
                    {isOfficer ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (officer)
                      </span>
                    ) : (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (read-only)
                      </span>
                    )}
                  </TableCell>
                  {years.map((year, index) => {
                    if (isOfficer && field) {
                      const value = manualYears[year]?.[field];
                      return (
                        <TableCell
                          key={`${row.metric}-${year}`}
                          className="min-w-[8rem] whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">RM</span>
                            <Input
                              className="h-9"
                              type="number"
                              step="any"
                              aria-label={`${row.metric} FY${year}`}
                              disabled={disabled}
                              value={value == null ? "" : String(value)}
                              onChange={(e) => onChange(year, field, e.target.value)}
                            />
                          </div>
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell
                        key={`${row.metric}-${year}`}
                        className="whitespace-nowrap bg-muted/30 text-sm text-foreground"
                      >
                        {row.values[index] ?? "Data not available"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
