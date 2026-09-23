"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { StatusBadge } from "@cashsouk/ui";

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
  onAddPlaceholderYear?: (calendarYear: number) => void;
  disabled: boolean;
  emptyMessage?: string;
};

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
  onAddPlaceholderYear,
  disabled,
  emptyMessage = "No financial years available",
}: Props) {
  const headers = table.yearHeaders;
  const colCount = 1 + headers.length;

  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border">
      <Table className="min-w-[48rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 min-w-[13rem] bg-background py-3 text-sm font-semibold text-foreground">
              Financial Metric
            </TableHead>
            {headers.map((header) => (
              <TableHead
                key={header.key}
                className="min-w-[9rem] whitespace-nowrap bg-muted/10 py-3 text-left text-sm font-semibold text-foreground"
              >
                <div className="flex h-full min-w-0 flex-col items-start justify-center gap-1.5 px-1">
                  <div className="min-w-0">
                    <div className="leading-snug">{header.yearLabel}</div>
                    <div className="text-xs font-normal leading-snug text-muted-foreground">
                      {header.fyeLabel}
                    </div>
                    {!header.isPlaceholder ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1 pb-1">
                        {header.sourceType ? (
                          <StatusBadge
                            size="sm"
                            status={
                              header.sourceType === "CTOS"
                                ? "success"
                                : header.sourceType === "ADMIN_INPUT"
                                  ? "action"
                                  : "neutral"
                            }
                            label={
                              header.sourceType === "CTOS"
                                ? "CTOS"
                                : header.sourceType === "ISSUER_INPUT"
                                  ? "User Input"
                                  : "Admin Input"
                            }
                            showDot={false}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {header.isPlaceholder && header.adminFallbackEligible && !disabled && onAddPlaceholderYear ? (
                    <Button
                      type="button"
                      className="h-8 shrink-0 px-2 text-meta font-normal"
                      variant="outline"
                      onClick={() => {
                        const y = header.yearLabel.replace(/^FY/, "");
                        if (/^\d{4}$/.test(y)) onAddPlaceholderYear(Number(y));
                      }}
                    >
                      + Add
                    </Button>
                  ) : null}
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
                  </TableCell>
                  {headers.map((header, index) => {
                    if (spec.mode === "editable" && !header.isPlaceholder) {
                      const yearFromHeader = header.yearLabel.replace(/^FY/, "");
                      const yearKey = spec.yearKeyForHeader(
                        header.key,
                        /^\d{4}$/.test(yearFromHeader)
                          ? yearFromHeader
                          : (years?.[index] ?? yearFromHeader)
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
                        className={cn(
                          "whitespace-normal text-sm tabular-nums text-foreground",
                          row.values[index] === "—" && "bg-background"
                        )}
                        title={
                          header.isPlaceholder
                            ? "No financial record for this year"
                            : spec.mode === "reused"
                              ? spec.source
                              : undefined
                        }
                      >
                        {header.isPlaceholder ? (
                          "—"
                        ) : (
                          <div className="flex flex-col items-start gap-0.5">
                            {(() => {
                              const cellText = row.values[index] ?? "—";
                              const isRawMissing = cellText === "—";

                              return (
                                <>
                                  <span
                                    className={cn(
                                      isRawMissing ? "text-muted-foreground" : undefined
                                    )}
                                  >
                                    {cellText}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        )}
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
