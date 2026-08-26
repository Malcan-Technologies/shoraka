"use client";

import Link from "next/link";
import { Card, CardContent, Skeleton } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import type { BookMetrics } from "@cashsouk/types";
import { cn } from "@/lib/utils";

const EMPTY_METRIC = { amount: 0, count: 0 };

const CARDS: {
  key: keyof BookMetrics;
  title: string;
  countLabel: string;
  tone?: "distressed";
}[] = [
  { key: "outstanding", title: "Outstanding", countLabel: "active notes" },
  { key: "inFunding", title: "In funding", countLabel: "notes on market" },
  { key: "distressed", title: "Arrears / default", countLabel: "notes", tone: "distressed" },
  { key: "dueSoon", title: "Due in 7 days", countLabel: "notes maturing" },
];

function noteCountLabel(count: number, noun: string): string {
  const unit = count === 1 ? noun.replace(/notes/, "note") : noun;
  return `${count} ${unit}`;
}

interface BookMetricsRowProps {
  metrics?: BookMetrics;
  loading?: boolean;
}

export function BookMetricsRow({ metrics, loading = false }: BookMetricsRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const metric = metrics?.[card.key] ?? EMPTY_METRIC;
        if (loading) {
          return (
            <Card key={card.key} className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="mb-3 h-3.5 w-28" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="mt-2 h-3 w-20" />
              </CardContent>
            </Card>
          );
        }

        return (
          <Link
            key={card.key}
            href="/notes"
            className="min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="rounded-2xl shadow-sm transition-colors hover:bg-muted/40">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p
                  className={cn(
                    "mt-2 text-2xl font-bold tabular-nums tracking-tight",
                    card.tone === "distressed" && metric.count > 0
                      ? "text-status-rejected-text"
                      : "text-foreground"
                  )}
                >
                  {formatCurrency(metric.amount)}
                </p>
                <p className="mt-1 text-meta text-muted-foreground">
                  {noteCountLabel(metric.count, card.countLabel)}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
