"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminEntityHeaderMetric = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Accent for the value (and hint, if present). */
  accentClassName?: string;
};

export type AdminEntityHeaderProps = {
  backHref: string;
  backLabel: string;
  /** Small record-type line above the title. */
  eyebrow?: string;
  title: string;
  /** Reference, owner, or other identity line under the title. */
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Workflow status badge plus type/identity chips. */
  chips?: React.ReactNode;
  /** Persistent facts (e.g. settlement amount) shown above the visualization. */
  metrics?: AdminEntityHeaderMetric[];
  /** Visual summary under the identity row (funding / utilization bar). */
  visualization?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Compact identity block for admin entity-detail pages. Stays visible on every
 * tab so orientation never depends on which panel is open.
 */
export function AdminEntityHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  chips,
  metrics,
  visualization,
  actions,
  className,
}: AdminEntityHeaderProps) {
  return (
    <header className={cn("space-y-4", className)}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
        <Link href={backHref}>
          <ArrowLeftIcon className="h-4 w-4" />
          {backLabel}
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            {eyebrow ? (
              <p className="text-meta uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
            ) : null}
            <h1 className="truncate text-section-title">{title}</h1>
            {subtitle ? <p className="text-ui text-muted-foreground">{subtitle}</p> : null}
            {chips ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">{chips}</div>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end lg:pt-1">
            {actions}
          </div>
        ) : null}
      </div>

      {(metrics && metrics.length > 0) || visualization ? (
        <div className="space-y-4 border-t border-border pt-4">
          {metrics && metrics.length > 0 ? (
            <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]">
              {metrics.map((metric) => (
                <div key={metric.label} className="min-w-0">
                  <dt className="text-meta text-muted-foreground">{metric.label}</dt>
                  <dd
                    className={cn(
                      "mt-0.5 truncate text-body font-semibold tabular-nums tracking-tight",
                      metric.accentClassName
                    )}
                  >
                    {metric.value}
                  </dd>
                  {metric.hint ? (
                    <div
                      className={cn(
                        "mt-0.5 truncate text-meta",
                        metric.accentClassName || "text-muted-foreground"
                      )}
                    >
                      {metric.hint}
                    </div>
                  ) : null}
                </div>
              ))}
            </dl>
          ) : null}
          {visualization}
        </div>
      ) : null}
    </header>
  );
}
