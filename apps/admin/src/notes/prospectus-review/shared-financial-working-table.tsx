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
import { cn } from "@/lib/utils";
import type { FinancialMetricTableModel } from "./financial-metric-table";
import { FINANCIAL_CELL_PLACEHOLDERS, FINANCIAL_PLACEHOLDERS } from "./working-area-placeholders";

export type FinancialInputKind = "money" | "ratio" | "percent" | "days";

export type FinancialRowMode =
  | { mode: "readonly" }
  | {
      mode: "editable";
      field: string;
      kind: FinancialInputKind;
      /** Calendar year or FYE header key used for get/set. */
      yearKeyForHeader: (headerKey: string, yearLabel: string) => string;
      cellPlaceholder?: string;
      fullPlaceholder?: string;
    }
  | { mode: "reused"; /** Internal only — shown as tooltip, not visible cell text. */ source?: string };

type Props = {
  table: FinancialMetricTableModel;
  /** Ordered year keys aligned with table.yearHeaders when using calendar years. */
  years?: readonly string[];
  resolveRow: (metric: string) => FinancialRowMode;
  getEditableValue: (yearKey: string, field: string) => string | number | null | undefined;
  onChange: (yearKey: string, field: string, value: string) => void;
  disabled: boolean;
  emptyMessage?: string;
};

function unitHint(kind: FinancialInputKind): string {
  if (kind === "money") return "MYR";
  if (kind === "ratio") return "x";
  if (kind === "percent") return "%";
  return "days";
}

function cellPlaceholder(kind: FinancialInputKind): string {
  return FINANCIAL_CELL_PLACEHOLDERS[kind];
}

function fullPlaceholder(kind: FinancialInputKind): string {
  return FINANCIAL_PLACEHOLDERS[kind];
}

/**
 * Shared Admin financial working table for Page 2 and Page 3.
 * Inline edits only — no detached forms.
 */
export function ProspectusSharedFinancialWorkingTable({
  table,
  years,
  resolveRow,
  getEditableValue,
  onChange,
  disabled,
  emptyMessage = "No financial years available",
}: Props) {
  const headers = table.yearHeaders;
  const colCount = 1 + headers.length;

  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border">
      <Table className="min-w-[36rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 min-w-[11rem] bg-background text-sm font-semibold text-foreground">
              Financial Metric
            </TableHead>
            {headers.map((header) => (
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
              <TableCell colSpan={colCount} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.rows.map((row) => {
              const spec = resolveRow(row.metric);
              return (
                <TableRow key={row.metric}>
                  <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-background text-sm font-medium text-foreground">
                    {row.metric}
                    {spec.mode === "editable" ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({unitHint(spec.kind)})
                      </span>
                    ) : null}
                  </TableCell>
                  {headers.map((header, index) => {
                    if (spec.mode === "editable") {
                      const yearKey = spec.yearKeyForHeader(
                        header.key,
                        years?.[index] ?? header.yearLabel.replace(/^FY/, "")
                      );
                      const raw = getEditableValue(yearKey, spec.field);
                      const empty = raw == null || raw === "";
                      return (
                        <TableCell
                          key={`${row.metric}-${header.key}`}
                          className="min-w-[8rem] whitespace-nowrap"
                        >
                          <Input
                            className={cn(
                              "h-9 text-sm",
                              empty &&
                                !disabled &&
                                "border-amber-500/70 focus-visible:ring-amber-500/40"
                            )}
                            type="number"
                            step={spec.kind === "days" ? "1" : "any"}
                            aria-label={`${row.metric} ${header.yearLabel}`}
                            title={spec.fullPlaceholder ?? fullPlaceholder(spec.kind)}
                            disabled={disabled}
                            placeholder={spec.cellPlaceholder ?? cellPlaceholder(spec.kind)}
                            value={empty ? "" : String(raw)}
                            onChange={(e) => onChange(yearKey, spec.field, e.target.value)}
                          />
                          {empty && !disabled ? (
                            <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                              Required for {header.yearLabel}
                            </span>
                          ) : null}
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell
                        key={`${row.metric}-${header.key}`}
                        className="whitespace-nowrap bg-muted/30 text-sm tabular-nums text-foreground"
                        title={spec.mode === "reused" ? spec.source : undefined}
                      >
                        {row.values[index] ?? "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {table.sourceFooter ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">{table.sourceFooter}</p>
      ) : null}
    </div>
  );
}
