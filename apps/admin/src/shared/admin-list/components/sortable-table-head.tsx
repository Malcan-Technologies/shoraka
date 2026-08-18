"use client";

import {
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TableSortDirection } from "../table-sort";

type SortableTableHeadProps<TColumn extends string> = {
  column: TColumn;
  label: string;
  activeColumn: TColumn | null;
  direction: TableSortDirection;
  onSort: (column: TColumn) => void;
  className?: string;
  title?: string;
};

export function SortableTableHead<TColumn extends string>({
  column,
  label,
  activeColumn,
  direction,
  onSort,
  className,
  title,
}: SortableTableHeadProps<TColumn>) {
  const active = activeColumn === column;
  const Icon = !active ? ChevronUpDownIcon : direction === "asc" ? ChevronUpIcon : ChevronDownIcon;

  return (
    <TableHead
      className={cn("truncate", className)}
      title={title ?? `Sort by ${label}`}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex max-w-full items-center gap-1 text-left text-ui font-medium hover:text-foreground",
          active && "text-foreground"
        )}
      >
        <span className="truncate">{label}</span>
        <Icon
          className={cn("h-3.5 w-3.5 shrink-0", active ? "text-foreground" : "text-muted-foreground")}
          aria-hidden
        />
      </button>
    </TableHead>
  );
}
