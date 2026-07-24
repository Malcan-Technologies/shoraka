"use client";

import type { FinancialMetricTableModel } from "./financial-metric-table";
import { PAGE_TWO_OFFICER_FINANCIAL_METRICS } from "./page-two-coverage";
import {
  ProspectusSharedFinancialWorkingTable,
  type FinancialRowMode,
} from "./shared-financial-working-table";
import {
  FINANCIAL_CELL_PLACEHOLDERS,
  PAGE_TWO_FINANCIAL_PLACEHOLDERS,
} from "./working-area-placeholders";

const OFFICER_BY_LABEL = new Map<string, (typeof PAGE_TWO_OFFICER_FINANCIAL_METRICS)[number]>(
  PAGE_TWO_OFFICER_FINANCIAL_METRICS.map((m) => [m.label, m])
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

function resolveRow(metric: string): FinancialRowMode {
  const officer = OFFICER_BY_LABEL.get(metric);
  if (!officer) return { mode: "readonly" };
  const kind =
    officer.key === "receivablesDays"
      ? "days"
      : officer.key === "netDebtEquity"
        ? "ratio"
        : "ratio";
  const full = PAGE_TWO_FINANCIAL_PLACEHOLDERS[officer.key];
  const cell =
    officer.key === "receivablesDays"
      ? FINANCIAL_CELL_PLACEHOLDERS.days
      : officer.key === "netDebtEquity"
        ? FINANCIAL_CELL_PLACEHOLDERS.ratio
        : "e.g. 12.1";
  return {
    mode: "editable",
    field: officer.key,
    kind,
    yearKeyForHeader: (headerKey) => headerKey,
    cellPlaceholder: cell,
    fullPlaceholder: full,
  };
}

/**
 * Page 2 Financial Comparison — one three-year table, inline officer edits.
 */
export function ProspectusFinancialComparisonWorkingTable({
  table,
  overrides,
  disabled,
  onChange,
}: Props) {
  return (
    <ProspectusSharedFinancialWorkingTable
      table={table}
      resolveRow={resolveRow}
      getEditableValue={(yearKey, field) => {
        const yearOverride =
          overrides?.[yearKey] ??
          overrides?.[yearKey.slice(0, 4)] ??
          overrides?.[`${yearKey.slice(0, 4)}-12-31`];
        return yearOverride?.[field as keyof NonNullable<typeof yearOverride>];
      }}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
