export type TableSortDirection = "asc" | "desc";
export type TableSortValue = string | number | null;

export type TableSortState<TColumn extends string> = {
  column: TColumn | null;
  direction: TableSortDirection;
};

export function nextTableSort<TColumn extends string>(
  current: TableSortState<TColumn>,
  column: TColumn
): TableSortState<TColumn> {
  if (current.column === column) {
    return { column, direction: current.direction === "desc" ? "asc" : "desc" };
  }
  return { column, direction: "desc" };
}

function isMissingSortValue(value: TableSortValue): boolean {
  if (value == null) return true;
  if (typeof value === "number") return Number.isNaN(value);
  return value.trim() === "";
}

export function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: TableSortDirection
): number {
  return compareSortValues(left, right, direction);
}

export function compareSortValues(
  left: TableSortValue,
  right: TableSortValue,
  direction: TableSortDirection
): number {
  const leftMissing = isMissingSortValue(left);
  const rightMissing = isMissingSortValue(right);
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  if (typeof left === "number" && typeof right === "number") {
    return direction === "asc" ? left - right : right - left;
  }
  const comparison = String(left).localeCompare(String(right), "en", {
    numeric: true,
    sensitivity: "base",
  });
  return direction === "asc" ? comparison : -comparison;
}

export function timestampOrNull(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function sortRowsByColumn<TRow, TColumn extends string>(
  rows: readonly TRow[],
  state: TableSortState<TColumn>,
  getValue: (row: TRow, column: TColumn) => TableSortValue
): TRow[] {
  if (!state.column) return [...rows];
  const column = state.column;
  return [...rows].sort((left, right) =>
    compareSortValues(getValue(left, column), getValue(right, column), state.direction)
  );
}

export function sortRowsByNumericColumn<TRow, TColumn extends string>(
  rows: readonly TRow[],
  state: TableSortState<TColumn>,
  getValue: (row: TRow, column: TColumn) => number | null
): TRow[] {
  return sortRowsByColumn(rows, state, getValue);
}
