"use client";

import type { FinancialMetricTableModel } from "./financial-metric-table";
import {
  ProspectusSharedFinancialWorkingTable,
  type FinancialRowMode,
} from "./shared-financial-working-table";

const OFFICER: Record<string, { field: string; kind: "money" | "ratio" }> = {
  "Cash & Bank": { field: "cashAndBank", kind: "money" },
  "Trade Receivables": { field: "tradeReceivables", kind: "money" },
  "Total Equity": { field: "totalEquity", kind: "money" },
  "Quick Ratio": { field: "quickRatio", kind: "ratio" },
};

type Props = {
  table: FinancialMetricTableModel;
  years: readonly string[];
  manualYears: Record<string, Record<string, string | number | null | undefined> | undefined>;
  disabled: boolean;
  onChange: (year: string, field: string, value: string) => void;
};

export function ProspectusBalanceSheetWorkingTable({
  table,
  years,
  manualYears,
  disabled,
  onChange,
}: Props) {
  const resolveRow = (metric: string): FinancialRowMode => {
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
      emptyMessage="Data not available"
    />
  );
}
