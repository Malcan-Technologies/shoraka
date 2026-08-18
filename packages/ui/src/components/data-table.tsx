import * as React from "react";
import { cn } from "../lib/utils";

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Sticky left (first sticky columns stack). */
  sticky?: boolean;
  /** Hide this column in the stacked mobile layout. */
  hideOnMobile?: boolean;
  /** Mobile label; defaults to string header when available. */
  mobileLabel?: string;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  empty?: React.ReactNode;
  className?: string;
  tableClassName?: string;
}

function alignClass(align?: "left" | "right" | "center") {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  className,
  tableClassName,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }

  const stickyColumns = columns.filter((c) => c.sticky);
  const stickyLeftById = new Map<string, number>();
  let left = 0;
  for (const col of stickyColumns) {
    stickyLeftById.set(col.id, left);
    left += 140;
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className={cn("w-full min-w-full text-ui", tableClassName)}>
          <thead>
            <tr className="border-b bg-muted/40">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-ui font-semibold text-foreground",
                    alignClass(col.align),
                    col.sticky &&
                      "sticky z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80",
                    col.headerClassName
                  )}
                  style={
                    col.sticky
                      ? { left: stickyLeftById.get(col.id) ?? 0 }
                      : undefined
                  }
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={getRowKey(row, index)}
                className="group border-b last:border-0 odd:bg-muted/40 hover:bg-muted"
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "px-4 py-3 align-middle",
                      alignClass(col.align),
                      col.sticky &&
                        "sticky z-10 bg-background group-odd:bg-muted/40 group-hover:bg-muted",
                      col.className
                    )}
                    style={
                      col.sticky
                        ? { left: stickyLeftById.get(col.id) ?? 0 }
                        : undefined
                    }
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked rows */}
      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <div
            key={getRowKey(row, index)}
            className="rounded-xl border bg-card p-4"
          >
            <dl className="space-y-2">
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => {
                  const label =
                    col.mobileLabel ??
                    (typeof col.header === "string" ? col.header : col.id);
                  return (
                    <div
                      key={col.id}
                      className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-3 gap-y-1 text-ui"
                    >
                      <dt className="text-ui text-muted-foreground">{label}</dt>
                      <dd className={cn(alignClass(col.align), col.className)}>
                        {col.cell(row)}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
