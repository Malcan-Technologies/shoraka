"use client";

import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import type { PortfolioAtRiskMetric, PortfolioAtRiskSummary } from "@cashsouk/types";
import { Card, CardContent, Skeleton } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

const CARDS: {
  key: keyof Pick<
    PortfolioAtRiskSummary,
    "pastDue" | "par30" | "par60" | "par90" | "defaulted"
  >;
  title: string;
  hint: string;
  tone: "action" | "distressed";
}[] = [
  { key: "pastDue", title: "Past due", hint: "DPD > 0", tone: "action" },
  { key: "par30", title: "PAR30", hint: "DPD > 30", tone: "action" },
  { key: "par60", title: "PAR60", hint: "DPD > 60", tone: "distressed" },
  { key: "par90", title: "PAR90", hint: "DPD > 90 · SC", tone: "distressed" },
  { key: "defaulted", title: "Defaulted", hint: "Marked default", tone: "distressed" },
];

function noteCountLabel(count: number): string {
  return `${count} ${count === 1 ? "note" : "notes"}`;
}

function metricToneClass(tone: "action" | "distressed", metric: PortfolioAtRiskMetric): string {
  if (metric.count <= 0) return "text-foreground";
  return tone === "distressed" ? "text-status-rejected-text" : "text-status-action-text";
}

function ParGauge({
  percent,
  tone,
  title,
  empty,
}: {
  percent: number;
  tone: "action" | "distressed";
  title: string;
  empty: boolean;
}) {
  const value = Math.min(100, Math.max(0, percent));
  const radius = 36;
  const track = Math.PI * radius;
  const filled = (value / 100) * track;
  return (
    <div
      className="relative mx-auto h-[4.25rem] w-[7.75rem]"
      role="img"
      aria-label={`${title} is ${value.toFixed(1)} percent of book`}
    >
      <svg viewBox="0 0 88 52" className="h-full w-full" aria-hidden>
        <path
          d="M 8 48 A 36 36 0 0 1 80 48"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className="stroke-muted"
        />
        <path
          d="M 8 48 A 36 36 0 0 1 80 48"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={
            empty
              ? "stroke-muted-foreground/35"
              : tone === "distressed"
                ? "stroke-status-rejected-text"
                : "stroke-status-action-text"
          }
          strokeDasharray={`${filled} ${track}`}
        />
      </svg>
      <p className="absolute inset-x-0 bottom-0 text-center text-sm font-semibold tabular-nums tracking-tight">
        {value.toFixed(1)}%
      </p>
    </div>
  );
}

interface PortfolioAtRiskRowProps {
  summary?: PortfolioAtRiskSummary;
  loading?: boolean;
}

export function PortfolioAtRiskRow({ summary, loading = false }: PortfolioAtRiskRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {CARDS.map((card) => {
        if (loading) {
          return (
            <Card key={card.key} className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="mb-3 h-3.5 w-20" />
                <Skeleton className="mx-auto h-16 w-28 rounded-full" />
                <Skeleton className="mt-3 h-8 w-28" />
                <Skeleton className="mt-2 h-3 w-24" />
              </CardContent>
            </Card>
          );
        }

        const metric = summary?.[card.key] ?? { count: 0, amount: 0, percent: 0 };
        return (
          <Link
            key={card.key}
            href="/reports/ageing"
            className="min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="rounded-2xl shadow-sm transition-colors hover:bg-muted/40">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <div className="mt-3">
                  <ParGauge
                    percent={metric.percent}
                    tone={card.tone}
                    title={card.title}
                    empty={metric.count <= 0}
                  />
                </div>
                <p
                  className={cn(
                    "mt-2 text-2xl font-bold tabular-nums tracking-tight",
                    metricToneClass(card.tone, metric)
                  )}
                >
                  {formatCurrency(metric.amount)}
                </p>
                <p className="mt-1 text-meta text-muted-foreground">{noteCountLabel(metric.count)}</p>
                <p className="mt-1 text-meta text-muted-foreground">{card.hint}</p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
