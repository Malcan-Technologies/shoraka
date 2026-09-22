"use client";

import type { FinancialMetricTableModel } from "./financial-metric-table";
import {
  ProspectusSharedFinancialWorkingTable,
  type FinancialRowMode,
} from "./shared-financial-working-table";
// Page 2 override metrics are system-derived and rendered read-only in Admin.

type Props = {
  table: FinancialMetricTableModel;
  // Legacy shape kept for backwards compatibility, but Admin no longer edits these values.
  overrides: unknown;
  disabled: boolean;
  onChange: (fyeKey: string, field: string, value: string) => void;
};

function resolveRow(metric: string): FinancialRowMode {
  void metric;
  // These Page 2 override metrics are system-derived and should not be edited in Admin.
  // Keep Admin read-only even if legacy override state exists in saved drafts.
  return { mode: "readonly" };
}

/**
 * Page 2 Financial Comparison — one three-year table, inline officer edits.
 */
export function ProspectusFinancialComparisonWorkingTable({
  table,
  overrides: _overrides,
  disabled,
  onChange,
}: Props) {
  return (
    <ProspectusSharedFinancialWorkingTable
      table={table}
      resolveRow={resolveRow}
      getEditableValue={() => null}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
