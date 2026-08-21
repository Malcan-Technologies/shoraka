"use client";

import * as React from "react";
import {
  nextTableSort,
  sortRowsByColumn,
  type TableSortDirection,
  type TableSortState,
  type TableSortValue,
} from "./table-sort";

export function useTableSort<TRow, TColumn extends string>(
  rows: readonly TRow[],
  getValue: (row: TRow, column: TColumn) => TableSortValue
) {
  const [state, setState] = React.useState<TableSortState<TColumn>>({
    column: null,
    direction: "desc",
  });

  const sortedRows = React.useMemo(
    () => sortRowsByColumn(rows, state, getValue),
    [getValue, rows, state]
  );

  const onSort = React.useCallback((column: TColumn) => {
    setState((current) => nextTableSort(current, column));
  }, []);

  return {
    sortedRows,
    sortColumn: state.column,
    sortDirection: state.direction as TableSortDirection,
    onSort,
  };
}
