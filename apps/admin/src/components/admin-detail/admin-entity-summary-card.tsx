import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AdminEntitySummaryCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accentClassName?: string;
  className?: string;
};

/** Compact hero stat well. Pair with `AdminEntityHeader` `summaryCards` (max 3). */
export function AdminEntitySummaryCard({
  label,
  value,
  hint,
  accentClassName,
  className,
}: AdminEntitySummaryCardProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col rounded-xl border border-border bg-muted/50 px-4 py-3 md:px-4 md:py-4",
        className
      )}
    >
      <div
        className={cn("truncate text-meta", accentClassName ?? "text-muted-foreground")}
        title={label}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 min-w-0 text-section-title tabular-nums tracking-tight",
          (typeof value === "string" || typeof value === "number") && "truncate",
          accentClassName
        )}
      >
        {value}
      </div>
      <div
        aria-hidden={hint ? undefined : true}
        className={cn(
          "mt-1 min-h-[1rem] truncate text-meta",
          hint ? accentClassName || "text-muted-foreground" : "text-transparent"
        )}
      >
        {hint ?? "\u00a0"}
      </div>
    </div>
  );
}
