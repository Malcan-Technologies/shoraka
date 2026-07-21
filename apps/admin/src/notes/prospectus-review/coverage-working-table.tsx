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

const OFFICER_MONEY_METRICS = new Set(["Operating Cash Flow", "Free Cash Flow"]);
const OFFICER_MULTIPLE_METRICS = new Set(["Debt / Equity", "Asset Turnover"]);
const OFFICER_PERCENT_METRICS = new Set(["Return on Assets"]);
const OFFICER_DAYS_METRICS = new Set(["Payables Days"]);

const METRIC_TO_FIELD: Record<string, string> = {
  "Operating Cash Flow": "operatingCashFlow",
  "Free Cash Flow": "freeCashFlow",
  "Debt / Equity": "debtEquity",
  "Return on Assets": "returnOnAssets",
  "Payables Days": "payablesDays",
  "Asset Turnover": "assetTurnover",
};

type Props = {
  table: FinancialMetricTableModel;
  years: readonly string[];
  manualYears: Record<string, Record<string, string | number | null | undefined> | undefined>;
  disabled: boolean;
  onChange: (year: string, field: string, value: string) => void;
};

/**
 * One Coverage table for all selected years.
 * Six Prospectus-only rows are editable; Page 2 reused + ROE stay read-only.
 * Trend (3-Yr) remains Data not available.
 */
export function ProspectusCoverageWorkingTable({
  table,
  years,
  manualYears,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="min-w-0 max-w-full space-y-0 overflow-x-auto rounded-xl border">
      <Table className="min-w-[42rem]">
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
            <TableHead className="min-w-[7rem] whitespace-nowrap text-sm font-semibold text-foreground">
              Trend (3-Yr)
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={2 + table.yearHeaders.length}
                className="py-8 text-center text-muted-foreground"
              >
                Data not available
              </TableCell>
            </TableRow>
          ) : (
            table.rows.map((row) => {
              const isMoney = OFFICER_MONEY_METRICS.has(row.metric);
              const isMultiple = OFFICER_MULTIPLE_METRICS.has(row.metric);
              const isPercent = OFFICER_PERCENT_METRICS.has(row.metric);
              const isDays = OFFICER_DAYS_METRICS.has(row.metric);
              const isOfficer = isMoney || isMultiple || isPercent || isDays;
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
                            {isMoney ? (
                              <span className="text-xs text-muted-foreground">RM</span>
                            ) : null}
                            {isPercent ? (
                              <span className="text-xs text-muted-foreground">%</span>
                            ) : null}
                            {isMultiple ? (
                              <span className="text-xs text-muted-foreground">x</span>
                            ) : null}
                            {isDays ? (
                              <span className="text-xs text-muted-foreground">days</span>
                            ) : null}
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
                  <TableCell className="whitespace-nowrap bg-muted/30 text-sm text-muted-foreground">
                    Data not available
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
