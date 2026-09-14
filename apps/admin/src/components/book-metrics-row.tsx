"use client";

import Link from "next/link";
import { Card, CardContent, Skeleton, StatusBadge, type StatusToken } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import type { BookMetricHistoryPoint, BookMetrics } from "@cashsouk/types";
import { cn } from "@/lib/utils";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { sparklinePolylinePoints } from "@/components/dashboard/sparkline";

const EMPTY_METRIC = { amount: 0, count: 0 };

const CARDS: {
  key: Exclude<keyof BookMetrics, "distressed">;
  title: string;
  countLabel: string;
  href: string;
  chip: string;
  chipStatus: StatusToken;
  amountTone?: "distressed";
  strokeClass: string;
}[] = [
  {
    key: "outstanding",
    title: "Outstanding",
    countLabel: "active notes",
    href: "/notes",
    chip: "live",
    chipStatus: "active",
    strokeClass: "stroke-primary",
  },
  {
    key: "inFunding",
    title: "In funding",
    countLabel: "notes on market",
    href: "/notes",
    chip: "on market",
    chipStatus: "submitted",
    strokeClass: "stroke-status-submitted-text",
  },
  {
    key: "arrears",
    title: "Arrears",
    countLabel: "notes",
    href: "/notes?servicingStatus=ARREARS",
    chip: "arrears",
    chipStatus: "rejected",
    amountTone: "distressed",
    strokeClass: "stroke-status-rejected-text",
  },
  {
    key: "defaulted",
    title: "Default",
    countLabel: "notes",
    href: "/notes?servicingStatus=DEFAULTED",
    chip: "written down",
    chipStatus: "rejected",
    amountTone: "distressed",
    strokeClass: "stroke-status-rejected-text",
  },
  {
    key: "dueSoon",
    title: "Due in 7 days",
    countLabel: "notes maturing",
    href: "/notes",
    chip: "maturing",
    chipStatus: "action",
    strokeClass: "stroke-status-action-text",
  },
];

function noteCountLabel(count: number, noun: string): string {
  const unit = count === 1 ? noun.replace(/notes/, "note") : noun;
  return `${count} ${unit}`;
}

function MetricSparkline({
  values,
  strokeClass,
}: {
  values: number[];
  strokeClass: string;
}) {
  const points = sparklinePolylinePoints(values);
  if (!points) return null;
  return (
    <svg
      viewBox="0 0 100 26"
      preserveAspectRatio="none"
      className="mt-3 block h-[26px] w-full overflow-visible"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        className={strokeClass}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface BookMetricsRowProps {
  metrics?: BookMetrics;
  history?: BookMetricHistoryPoint[];
  loading?: boolean;
}

export function BookMetricsRow({ metrics, history, loading = false }: BookMetricsRowProps) {
  return (
    <section>
      <DashboardSectionHeader
        title="The book"
        subtitle="Where the money is lent out, and what is coming back"
        action={
          <Link href="/notes" className="text-ui font-medium text-primary hover:text-accent">
            All notes →
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {CARDS.map((card) => {
          const metric = metrics?.[card.key] ?? EMPTY_METRIC;
          const sparkValues = (history ?? [])
            .map((point) => point[card.key]?.amount)
            .filter((value): value is number => typeof value === "number");

          if (loading) {
            return (
              <Card key={card.key} className="rounded-2xl shadow-sm">
                <CardContent className="p-[18px]">
                  <Skeleton className="mb-3 h-3.5 w-28" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="mt-2 h-3 w-20" />
                  <Skeleton className="mt-3 h-[26px] w-full" />
                </CardContent>
              </Card>
            );
          }

          return (
            <Link
              key={card.key}
              href={card.href}
              className="min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="rounded-2xl shadow-sm transition-colors hover:bg-muted/40">
                <CardContent className="p-[18px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-ui font-medium text-muted-foreground">{card.title}</p>
                    <StatusBadge label={card.chip} status={card.chipStatus} size="sm" />
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-2xl font-bold tabular-nums tracking-tight",
                      card.amountTone === "distressed" && metric.count > 0
                        ? "text-status-rejected-text"
                        : "text-foreground"
                    )}
                  >
                    {formatCurrency(metric.amount)}
                  </p>
                  <p className="mt-0.5 text-meta text-muted-foreground">
                    {noteCountLabel(metric.count, card.countLabel)}
                  </p>
                  <MetricSparkline values={sparkValues} strokeClass={card.strokeClass} />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
