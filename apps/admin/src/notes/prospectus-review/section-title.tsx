"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

/** Same icon + title pattern as Application review section cards. */
export function ProspectusSectionTitle({
  title,
  icon: Icon,
  status,
  optional,
  missingCount,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  status?: "complete" | "incomplete" | "optional";
  optional?: boolean;
  missingCount?: number;
}) {
  const statusLabel = optional
    ? "Optional"
    : missingCount != null && missingCount > 0
      ? `${missingCount} missing`
      : missingCount === 0 || status === "complete"
        ? "Complete"
        : status === "incomplete"
          ? "Incomplete"
          : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {statusLabel ? (
        <span
          className={cn(
            "text-xs font-medium",
            optional
              ? "text-muted-foreground"
              : missingCount != null && missingCount > 0
                ? "text-amber-700 dark:text-amber-400"
                : "text-emerald-700 dark:text-emerald-400"
          )}
        >
          {statusLabel}
        </span>
      ) : null}
    </div>
  );
}
