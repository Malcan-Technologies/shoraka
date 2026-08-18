"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuickActionsSummaryBannerProps = {
  title: string;
  description?: string;
  href?: string;
  ctaLabel?: string;
  tone?: "action" | "neutral";
  /** Stack CTA under text (narrow sticky rail). */
  layout?: "row" | "stack";
  className?: string;
};

/** Admin-local summary banner for dashboard Quick Actions (not shared with issuer). */
export function QuickActionsSummaryBanner({
  title,
  description,
  href,
  ctaLabel,
  tone = "action",
  layout = "stack",
  className,
}: QuickActionsSummaryBannerProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-4",
        layout === "stack" && "flex-col",
        layout === "row" && "flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        tone === "action" &&
          "border-status-action-text/15 bg-[hsl(var(--status-action-bg)/0.45)] text-foreground",
        tone === "neutral" && "border-border bg-card",
        className
      )}
      role="status"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-body font-semibold">{title}</p>
        {description ? (
          <p className="text-ui text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {href && ctaLabel ? (
        <Button asChild className="h-11 w-full shrink-0 gap-2 rounded-xl font-semibold sm:w-auto">
          <Link href={href}>
            <span className="truncate">{ctaLabel}</span>
            <ArrowRightIcon className="h-4 w-4 shrink-0" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
