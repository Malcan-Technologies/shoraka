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
  /** `hero` is the inset used inside `AdminEntityHeader variant="hero"`. */
  variant?: "panel" | "hero";
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
  variant = "panel",
  className,
}: AdminMetricProgressProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const hero = variant === "hero";
  const valueClass = hero
    ? "mt-1 truncate text-section-title tabular-nums tracking-tight"
    : "mt-1 truncate text-body font-semibold";

  return (
    <div
      className={cn(
        "rounded-xl p-4",
        hero ? "border border-border bg-muted/50 md:p-5" : "border border-border bg-muted/20",
        className
      )}
    >
      <div className={cn("flex flex-wrap justify-between gap-3", hero ? "items-end" : "items-start")}>
        <div className="min-w-0">
          <div className={cn("text-meta", accentClassName ?? "text-muted-foreground")}>
            {leftLabel}
          </div>
          <div className={cn(valueClass, accentClassName)}>{leftValue}</div>
          {leftHint ? (
            <div className="mt-1 text-meta text-muted-foreground">{leftHint}</div>
          ) : null}
        </div>
        <div className="text-right">
          <div className={cn("text-meta", accentClassName ?? "text-muted-foreground")}>
            {rightLabel}
          </div>
          <div className={cn(valueClass, accentClassName)}>{rightValue}</div>
          {rightHint ? (
            <div className="mt-1 text-meta text-muted-foreground">{rightHint}</div>
          ) : null}
        </div>
      </div>
      <Progress
        value={clamped}
        className={cn(hero ? "mt-5 h-3.5" : "mt-4 h-3", barClassName)}
        indicatorClassName={indicatorClassName}
      />
      {footer ? <div className="mt-3 text-meta text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
