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
import { PAGE_TWO_OFFICER_FINANCIAL_METRICS } from "./page-two-coverage";

const OFFICER_BY_LABEL = new Map<string, (typeof PAGE_TWO_OFFICER_FINANCIAL_METRICS)[number]>(
  PAGE_TWO_OFFICER_FINANCIAL_METRICS.map((m) => [m.label, m] as const)
);

type Props = {
  table: FinancialMetricTableModel;
  overrides:
    | Record<
        string,
        Partial<
          Record<
            (typeof PAGE_TWO_OFFICER_FINANCIAL_METRICS)[number]["key"],
            string | number | null | undefined
          >
        >
      >
    | null
    | undefined;
  disabled: boolean;
  onChange: (fyeKey: string, field: string, value: string) => void;
};

/**
 * Page 2 Financial Comparison working table.
 * System rows: grey read-only cells. Officer rows: in-cell inputs (no DNA + form below).
 */
export function ProspectusFinancialComparisonWorkingTable({
  table,
  overrides,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border">
      <Table className="min-w-[36rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 min-w-[11rem] bg-background text-sm font-semibold">
              Metric
            </TableHead>
            {table.yearHeaders.map((header) => (
              <TableHead
                key={header.key}
                className="min-w-[8rem] whitespace-nowrap text-sm font-semibold"
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
                No financial years available
              </TableCell>
            </TableRow>
          ) : (
            table.rows.map((row) => {
              const officer = OFFICER_BY_LABEL.get(row.metric);
              return (
                <TableRow key={row.metric}>
                  <TableCell className="sticky left-0 z-10 bg-background text-sm font-medium">
                    {row.metric}
                    {officer ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({officer.unit})
                      </span>
                    ) : null}
                  </TableCell>
                  {table.yearHeaders.map((header, index) => {
                    if (officer) {
                      const yearOverride =
                        overrides?.[header.key] ??
                        overrides?.[header.key.slice(0, 4)] ??
                        overrides?.[`${header.key.slice(0, 4)}-12-31`];
                      const raw = yearOverride?.[officer.key];
                      return (
                        <TableCell key={`${row.metric}-${header.key}`} className="min-w-[8rem]">
                          <Input
                            className="h-9"
                            type="number"
                            step={officer.key === "receivablesDays" ? "1" : "any"}
                            aria-label={`${row.metric} ${header.yearLabel}`}
                            disabled={disabled}
                            value={raw == null || raw === "" ? "" : String(raw)}
                            onChange={(e) =>
                              onChange(header.key, officer.key, e.target.value)
                            }
                          />
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell
                        key={`${row.metric}-${header.key}`}
                        className="bg-muted/30 text-sm tabular-nums text-foreground"
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
