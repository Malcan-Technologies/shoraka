"use client";

import type { FinancialMetricTableModel } from "./financial-metric-table";
import {
  ProspectusSharedFinancialWorkingTable,
  type FinancialRowMode,
} from "./shared-financial-working-table";

const OFFICER: Record<
  string,
  { field: string; kind: "money" | "ratio" | "percent" | "days" }
> = {
  "Operating Cash Flow": { field: "operatingCashFlow", kind: "money" },
  "Free Cash Flow": { field: "freeCashFlow", kind: "money" },
  "Payables Days": { field: "payablesDays", kind: "days" },
};

const REUSED = new Set(["Interest Coverage", "DSCR", "Receivables Days"]);

type Props = {
  table: FinancialMetricTableModel;
  years: readonly string[];
  manualYears: Record<string, Record<string, string | number | null | undefined> | undefined>;
  disabled: boolean;
  onChange: (year: string, field: string, value: string) => void;
};

/**
 * Coverage table: officer cells inline; IC/DSCR/Receivables Days reused from Page 2.
 * Trend column omitted from Admin working area.
 */
export function ProspectusCoverageWorkingTable({
  table,
  years,
  manualYears,
  disabled,
  onChange,
}: Props) {
  const resolveRow = (metric: string): FinancialRowMode => {
    if (REUSED.has(metric)) {
      return { mode: "reused", source: "From Page 2 — Financial Comparison" };
    }
    const officer = OFFICER[metric];
    if (!officer) return { mode: "readonly" };
    return {
      mode: "editable",
      field: officer.field,
      kind: officer.kind,
      yearKeyForHeader: (_headerKey, yearKey) => yearKey,
    };
  };

  return (
    <ProspectusSharedFinancialWorkingTable
      table={table}
      years={years}
      resolveRow={resolveRow}
      getEditableValue={(yearKey, field) => manualYears[yearKey]?.[field]}
      onChange={onChange}
      disabled={disabled}
      emptyMessage="—"
    />
  );
}
