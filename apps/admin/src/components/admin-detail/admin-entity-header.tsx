"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StatusToken } from "@cashsouk/ui";
import {
  ADMIN_HERO_PATTERN_CLASS,
  ADMIN_HERO_SURFACE_CLASS,
  adminHeroTintModifierClass,
  HERO_SUMMARY_CARD_LIMIT,
  heroAsideClusterClass,
  heroSummaryClusterClass,
  type AdminHeroTint,
} from "./admin-entity-header-layout";

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
  /** Status token matching the header badge — tints the hero card lighter than the chip. */
  tone?: StatusToken;
  /**
   * Hero card wash. `status` follows `tone`; `issuer` is brand red; `investor`
   * is the investor-portal earth brown.
   */
  heroTint?: AdminHeroTint;
  /** Persistent facts (e.g. settlement amount, commercial terms). */
  metrics?: AdminEntityHeaderMetric[];
  /** Up to 3 compact stat cards in the hero top-right (e.g. payment due, investors). */
  summaryCards?: React.ReactNode[];
  /** Visual summary (funding / utilization bar). Hero places this under identity. */
  visualization?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * `hero` is the reusable entity-detail card: identity, optional progress,
   * then a facts strip. Notes, facilities, organisations, and accounts opt in.
   */
  variant?: "plain" | "hero";
  className?: string;
};

export { HERO_SUMMARY_CARD_LIMIT, heroSummaryClusterClass };

function EntityBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
      <Link href={href}>
        <ArrowLeftIcon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

function EntityIdentity({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  chips,
  compact,
}: Pick<AdminEntityHeaderProps, "eyebrow" | "title" | "subtitle" | "icon" | "chips"> & {
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {Icon ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl bg-primary/10",
            compact ? "h-10 w-10" : "h-12 w-12"
          )}
        >
          <Icon className={cn("text-primary", compact ? "h-5 w-5" : "h-6 w-6")} />
        </span>
      ) : null}
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-meta uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="truncate text-section-title" title={title}>
          {title}
        </h1>
        {subtitle ? (
          <p className="break-words text-ui text-muted-foreground">{subtitle}</p>
        ) : null}
        {chips ? <div className="flex flex-wrap items-center gap-2 pt-1">{chips}</div> : null}
      </div>
    </div>
  );
}

function EntityTitleRow({
  eyebrow,
  title,
  subtitle,
  icon,
  chips,
  actions,
  compact,
}: Pick<
  AdminEntityHeaderProps,
  "eyebrow" | "title" | "subtitle" | "icon" | "chips" | "actions"
> & { compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <EntityIdentity
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        icon={icon}
        chips={chips}
        compact={compact}
      />
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end lg:pt-1">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function EntitySummaryCards({ cards }: { cards: React.ReactNode[] }) {
  const items = cards.slice(0, HERO_SUMMARY_CARD_LIMIT);
  if (items.length === 0) return null;

  return (
    <div className={heroSummaryClusterClass(items.length)}>
      {items.map((card, index) => (
        <div key={index} className="flex min-w-0 lg:flex-1">
          {card}
        </div>
      ))}
    </div>
  );
}

function EntityMetricsStrip({ metrics }: { metrics: AdminEntityHeaderMetric[] }) {
  return (
    <dl className="flex flex-wrap justify-start gap-x-10 gap-y-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="min-w-0 shrink-0">
          <dt className="text-meta text-muted-foreground">{metric.label}</dt>
          <dd
            className={cn(
              "mt-0.5 min-w-0 text-body font-semibold tabular-nums tracking-tight",
              typeof metric.value === "string" && "truncate",
              metric.accentClassName
            )}
          >
            {metric.value}
          </dd>
          {metric.hint ? (
            <div
              className={cn(
                "mt-0.5 min-w-0 text-meta",
                typeof metric.hint === "string" && "truncate",
                metric.accentClassName || "text-muted-foreground"
              )}
            >
              {metric.hint}
            </div>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/**
 * Persistent identity block for admin entity-detail pages. Stays visible on
 * every tab so orientation never depends on which panel is open.
 *
 * `variant="hero"` is the reusable entity card: identity + up to 3 top-right
 * summary cards, optional progress bar below, then a facts strip.
 */
export function AdminEntityHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  icon,
  chips,
  tone,
  heroTint = "status",
  metrics,
  summaryCards,
  visualization,
  actions,
  variant = "plain",
  className,
}: AdminEntityHeaderProps) {
  const metricRows = metrics && metrics.length > 0 ? metrics : null;
  const tintModifier = adminHeroTintModifierClass(heroTint, tone);
  const identity = (
    <EntityIdentity
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      icon={icon}
      chips={chips}
      compact={variant !== "hero"}
    />
  );

  if (variant === "hero") {
    return (
      <header className={cn("space-y-4", className)}>
        <EntityBackLink href={backHref} label={backLabel} />
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border shadow-sm md:shadow",
            tintModifier ? [ADMIN_HERO_SURFACE_CLASS, tintModifier] : "border-border bg-card"
          )}
        >
          {tintModifier ? (
            <div aria-hidden className={cn("pointer-events-none absolute inset-0", ADMIN_HERO_PATTERN_CLASS)} />
          ) : null}
          <div className="relative space-y-6 p-6 md:p-8">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1">{identity}</div>
              {(summaryCards && summaryCards.length > 0) || actions ? (
                <div
                  className={heroAsideClusterClass(
                    summaryCards && summaryCards.length > 0 ? summaryCards.length : 1
                  )}
                >
                  {summaryCards && summaryCards.length > 0 ? (
                    <EntitySummaryCards cards={summaryCards} />
                  ) : null}
                  {actions ? (
                    <div className="flex w-full flex-wrap items-center gap-2 lg:justify-end">
                      {actions}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {visualization}
          </div>
          {metricRows ? (
            <div className="relative border-t border-border/80 px-6 py-4 md:px-8">
              <EntityMetricsStrip metrics={metricRows} />
            </div>
          ) : null}
        </div>
      </header>
    );
  }

  return (
    <header className={cn("space-y-4", className)}>
      <EntityBackLink href={backHref} label={backLabel} />
      <EntityTitleRow
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        icon={icon}
        chips={chips}
        actions={actions}
        compact
      />
      {metricRows || visualization ? (
        <div className="space-y-4 border-t border-border pt-4">
          {metricRows ? <EntityMetricsStrip metrics={metricRows} /> : null}
          {visualization}
        </div>
      ) : null}
    </header>
  );
}
