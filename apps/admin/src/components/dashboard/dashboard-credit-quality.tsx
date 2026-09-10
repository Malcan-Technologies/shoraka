"use client";

import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import {
  par90LimitStatus,
  SC_PAR90_LIMIT_PERCENT,
  type PortfolioAtRiskMetric,
  type PortfolioAtRiskSummary,
} from "@cashsouk/types";
import { Card, CardContent, Skeleton } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { DashboardSectionHeader } from "./dashboard-section-header";
import { ladderBarWidth, par90LimitBarWidth } from "./dashboard-credit-quality-bars";

const LADDER: {
  key: keyof Pick<PortfolioAtRiskSummary, "pastDue" | "par30" | "par60" | "par90" | "defaulted">;
  label: string;
  tone: "action" | "distressed";
}[] = [
  { key: "pastDue", label: "Past due", tone: "action" },
  { key: "par30", label: "PAR30", tone: "action" },
  { key: "par60", label: "PAR60", tone: "distressed" },
  { key: "par90", label: "PAR90", tone: "distressed" },
  { key: "defaulted", label: "Defaulted", tone: "distressed" },
];

const EXCLUSIVE: {
  key: keyof PortfolioAtRiskSummary["exclusive"];
  label: string;
  tone: "action" | "distressed";
}[] = [
  { key: "dpd1To30", label: "1–30", tone: "action" },
  { key: "dpd31To60", label: "31–60", tone: "action" },
  { key: "dpd61To90", label: "61–90", tone: "distressed" },
  { key: "dpd90Plus", label: ">90", tone: "distressed" },
];

function noteCountLabel(count: number): string {
  return `${count} ${count === 1 ? "note" : "notes"}`;
}

function emptyMetric(): PortfolioAtRiskMetric {
  return { count: 0, amount: 0, percent: 0 };
}

export function DashboardCreditQuality({
  summary,
  loading = false,
  errorMessage,
}: {
  summary?: PortfolioAtRiskSummary;
  loading?: boolean;
  errorMessage?: string | null;
}) {
  const par90 = summary?.par90 ?? emptyMetric();
  const limitStatus = par90LimitStatus(par90.percent);
  const exclusiveMax = Math.max(
    0,
    ...EXCLUSIVE.map((bucket) => summary?.exclusive[bucket.key]?.amount ?? 0)
  );

  return (
    <section>
      <DashboardSectionHeader
        title="Credit quality"
        subtitle="Portfolio at risk by days past due. PAR90 matches the SC/BNM >90 DPD test"
        action={
          <Link href="/reports/ageing" className="text-ui font-medium text-primary hover:text-accent">
            Ageing report →
          </Link>
        }
      />

      {errorMessage ? <p className="mb-3 text-ui text-destructive">{errorMessage}</p> : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-40" />
                <Skeleton className="h-3.5 w-full rounded-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ui font-medium text-muted-foreground">PAR90</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-meta",
                      limitStatus === "inside"
                        ? "bg-status-success-bg text-status-success-text"
                        : "bg-status-rejected-bg text-status-rejected-text"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        limitStatus === "inside" ? "bg-status-success-text" : "bg-status-rejected-text"
                      )}
                      aria-hidden
                    />
                    {limitStatus === "inside" ? "inside limit" : "over limit"}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-baseline gap-2.5">
                  <span className="text-4xl font-bold tabular-nums tracking-tight leading-none">
                    {par90.percent.toFixed(1)}%
                  </span>
                  <span className="text-ui text-muted-foreground">
                    of book · {formatCurrency(par90.amount)} · {noteCountLabel(par90.count)}
                  </span>
                </div>
                <div className="relative mt-5 h-3.5 overflow-visible rounded-full bg-muted">
                  <div
                    className="h-3.5 rounded-full bg-status-action-text"
                    style={{ width: `${par90LimitBarWidth(par90.percent)}%` }}
                  />
                  <div
                    className="absolute bottom-[-6px] top-[-6px] w-0.5 bg-status-rejected-text"
                    style={{ left: "100%", transform: "translateX(-1px)" }}
                    aria-hidden
                  />
                </div>
                <div className="mt-2 flex justify-between text-meta text-muted-foreground">
                  <span>0%</span>
                  <span className="font-medium text-status-rejected-text">
                    SC limit {SC_PAR90_LIMIT_PERCENT.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
                  {LADDER.map((row) => {
                    const metric = summary?.[row.key] ?? emptyMetric();
                    return (
                      <div key={row.key} className="flex items-center gap-2.5 text-ui">
                        <span
                          className={cn(
                            "w-[7rem] shrink-0 text-foreground",
                            row.key === "par90" && "font-medium"
                          )}
                        >
                          {row.label}
                        </span>
                        <span className="block h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              row.tone === "distressed"
                                ? "bg-status-rejected-text"
                                : "bg-status-action-text"
                            )}
                            style={{ width: `${ladderBarWidth(metric.percent)}%` }}
                          />
                        </span>
                        <span className="w-12 text-right font-semibold tabular-nums">
                          {metric.percent.toFixed(1)}%
                        </span>
                        <span className="hidden w-[7.5rem] text-right tabular-nums text-muted-foreground sm:block">
                          {formatCurrency(metric.amount)}
                        </span>
                        <span className="hidden w-16 text-right text-meta text-muted-foreground lg:block">
                          {noteCountLabel(metric.count)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-44 w-full" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-ui font-medium">Overdue balance by DPD bucket</p>
                  <p className="text-meta text-muted-foreground">
                    {formatCurrency(summary?.exclusive.current.amount ?? 0)} current
                  </p>
                </div>
                <div className="mt-6 grid h-44 grid-cols-4 items-end gap-4">
                  {EXCLUSIVE.map((bucket) => {
                    const metric = summary?.exclusive[bucket.key] ?? emptyMetric();
                    const height =
                      exclusiveMax > 0 && metric.amount > 0
                        ? Math.max(8, (metric.amount / exclusiveMax) * 100)
                        : 0;
                    return (
                      <div key={bucket.key} className="flex h-full flex-col justify-end gap-2">
                        <div className="text-center text-ui font-semibold tabular-nums">
                          {formatCurrency(metric.amount)}
                        </div>
                        <div
                          className={cn(
                            "rounded-t-lg border-t-[3px]",
                            bucket.tone === "distressed"
                              ? "border-status-rejected-text bg-status-rejected-bg"
                              : "border-status-action-text bg-status-action-bg"
                          )}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 grid grid-cols-4 gap-4 border-t border-border pt-2">
                  {EXCLUSIVE.map((bucket) => {
                    const metric = summary?.exclusive[bucket.key] ?? emptyMetric();
                    return (
                      <div key={bucket.key} className="text-center">
                        <div
                          className={cn(
                            "text-ui text-foreground",
                            bucket.key === "dpd90Plus" && "font-medium"
                          )}
                        >
                          {bucket.label}
                        </div>
                        <div className="text-meta text-muted-foreground">{noteCountLabel(metric.count)}</div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-pretty text-meta text-muted-foreground">
                  Buckets are cumulative in the PAR ladder, exclusive here — a note appears once, in its
                  oldest overdue bucket.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
