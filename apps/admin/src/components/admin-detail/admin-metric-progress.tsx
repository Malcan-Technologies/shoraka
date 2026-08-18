"use client";

import * as React from "react";
import { Progress } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

export type AdminMetricProgressProps = {
  percent: number;
  leftLabel: string;
  leftValue: string;
  leftHint?: string;
  rightLabel: string;
  rightValue: string;
  rightHint?: string;
  barClassName?: string;
  indicatorClassName?: string;
  accentClassName?: string;
  /** Extra line under the bar (e.g. notes drawing on a facility). */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Persistent header visualization for funded/utilized amounts.
 */
export function AdminMetricProgress({
  percent,
  leftLabel,
  leftValue,
  leftHint,
  rightLabel,
  rightValue,
  rightHint,
  barClassName,
  indicatorClassName,
  accentClassName,
  footer,
  className,
}: AdminMetricProgressProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);

  return (
    <div className={cn("rounded-xl border bg-muted/20 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("text-meta", accentClassName ?? "text-muted-foreground")}>
            {leftLabel}
          </div>
          <div className={cn("mt-1 truncate text-body font-semibold", accentClassName)}>
            {leftValue}
          </div>
          {leftHint ? (
            <div className="mt-1 text-meta text-muted-foreground">{leftHint}</div>
          ) : null}
        </div>
        <div className="text-right">
          <div className={cn("text-meta", accentClassName ?? "text-muted-foreground")}>
            {rightLabel}
          </div>
          <div className={cn("mt-1 text-body font-semibold", accentClassName)}>{rightValue}</div>
          {rightHint ? (
            <div className="mt-1 text-meta text-muted-foreground">{rightHint}</div>
          ) : null}
        </div>
      </div>
      <Progress
        value={clamped}
        className={cn("mt-4 h-3", barClassName)}
        indicatorClassName={indicatorClassName}
      />
      {footer ? <div className="mt-3 text-meta text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
