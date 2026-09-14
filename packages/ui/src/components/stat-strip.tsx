import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Skeleton } from "./skeleton";

export type StatStripCell = {
  label: string;
  value: ReactNode;
  accent?: boolean;
  loading?: boolean;
};

export function StatStrip({
  cells,
  action,
  className,
}: {
  cells: readonly StatStripCell[];
  action?: ReactNode;
  className?: string;
}) {
  const compactThree = cells.length <= 3 && !action;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div
        className={cn(
          "grid divide-border sm:flex sm:flex-row sm:items-stretch sm:divide-x sm:divide-y-0",
          compactThree
            ? "grid-cols-3 divide-x"
            : "grid-cols-2 divide-x divide-y"
        )}
      >
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0 flex-1 px-2.5 py-4 sm:px-4 sm:py-5">
            <div className="text-meta font-semibold uppercase tracking-wider text-muted-foreground">
              {cell.label}
            </div>
            {cell.loading ? (
              <Skeleton className="mt-2 h-7 w-20" />
            ) : (
              <div
                className={cn(
                  "mt-2 font-bold tabular-nums leading-tight tracking-tight",
                  compactThree ? "text-base sm:text-2xl" : "text-lg sm:text-2xl",
                  cell.accent ? "text-primary" : "text-foreground"
                )}
              >
                {cell.value}
              </div>
            )}
          </div>
        ))}
        {action ? (
          <div className="col-span-full flex items-end justify-stretch px-3.5 py-4 sm:justify-end sm:px-4 sm:py-5">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}
