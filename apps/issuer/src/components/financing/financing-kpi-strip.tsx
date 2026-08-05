import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared KPI tile used on financing list cards. */
export function FinancingKpiTile({
  label,
  value,
  trailing,
  labelExtra,
  className,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  trailing?: ReactNode;
  labelExtra?: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border/80 bg-muted/40 px-3 py-3",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <p className="text-[13px] font-normal leading-5 text-muted-foreground">{label}</p>
        {labelExtra}
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <p
          className={cn(
            "min-w-0 truncate text-xl font-semibold tabular-nums tracking-tight leading-7 text-foreground sm:text-[1.35rem] sm:leading-8",
            valueClassName
          )}
        >
          {value}
        </p>
        {trailing}
      </div>
    </div>
  );
}
