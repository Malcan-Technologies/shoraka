"use client";

import { useId } from "react";
import Link from "next/link";
import { Card, CardContent } from "@cashsouk/ui";
import { formatCurrency, formatNumber } from "@cashsouk/config";
import {
  formatNoteDateEnMy,
  formatNoteReferenceDisplay,
  type InvestorCashflowNext90Days,
  type InvestorPortfolioHistoryPoint,
} from "@cashsouk/types";
import {
  cashflowBarPercent,
  cashflowMonthMax,
  dualSeriesChartPaths,
  dueDateChipParts,
  historyAxisLabels,
  monthBucketLabel,
  portfolioHistoryScaleMax,
} from "@/investments/dashboard-presentation";

export function InvestorDashboardValueChart({
  points,
}: {
  points: InvestorPortfolioHistoryPoint[];
}) {
  const gradientId = useId();
  if (points.length < 2) return null;

  const totals = points.map((point) => point.portfolioTotal);
  const principals = points.map((point) => point.principal);
  const scaleMax = portfolioHistoryScaleMax(totals, principals);
  const valuePaths = dualSeriesChartPaths(totals, 600, 176, scaleMax);
  const principalPaths = dualSeriesChartPaths(principals, 600, 176, scaleMax);
  if (!valuePaths || !principalPaths) return null;

  const labels = historyAxisLabels(points);

  return (
    <Card className="min-w-0 rounded-2xl shadow-sm">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-card-title text-primary">Portfolio value over time</h2>
            <p className="mt-0.5 text-meta text-muted-foreground">
              Invested capital plus profit accrued
            </p>
          </div>
          <div className="flex gap-3.5 text-meta text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Total value
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              Principal
            </span>
          </div>
        </div>
        <svg
          viewBox="0 0 600 200"
          preserveAspectRatio="none"
          className="mt-4 block h-[200px] w-full"
        >
          <defs>
            <linearGradient id={`${gradientId}-value`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id={`${gradientId}-principal`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity="0.32" />
              <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <line x1="0" y1="20" x2="600" y2="20" stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <line x1="0" y1="72" x2="600" y2="72" stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <line x1="0" y1="124" x2="600" y2="124" stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <line x1="0" y1="176" x2="600" y2="176" stroke="hsl(var(--border))" />
          <path d={valuePaths.area} fill={`url(#${gradientId}-value)`} />
          <path
            d={valuePaths.line}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d={principalPaths.area} fill={`url(#${gradientId}-principal)`} />
          <path
            d={principalPaths.line}
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex justify-between text-meta text-muted-foreground">
          {labels.map((label) => (
            <span key={label}>{formatChartAxisDate(label)}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function InvestorDashboardCashflow({ cashflow }: { cashflow: InvestorCashflowNext90Days }) {
  const maxAmount = cashflowMonthMax(cashflow.months);
  const upcoming = cashflow.upcoming.slice(0, 3);

  return (
    <Card className="min-w-0 rounded-2xl shadow-sm">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-card-title text-primary">Money coming back</h2>
            <p className="mt-0.5 text-meta text-muted-foreground">
              Expected settlements, next 90 days
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrency(cashflow.totalAmount)}
            </p>
            <p className="text-meta text-muted-foreground">
              across {cashflow.noteCount} {cashflow.noteCount === 1 ? "note" : "notes"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid h-28 grid-cols-3 items-end gap-3.5">
          {cashflow.months.map((month, index) => {
            const height = cashflowBarPercent(month.amount, maxAmount);
            const opacityClass =
              index === 0 ? "bg-primary/90" : index === 1 ? "bg-primary/55" : "bg-secondary/65";
            return (
              <div key={month.yearMonth} className="flex h-full flex-col justify-end gap-2">
                <p className="text-center text-ui font-semibold tabular-nums">
                  {formatNumber(month.amount, 0)}
                </p>
                <div
                  className={`rounded-t-lg ${opacityClass}`}
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3.5 border-t border-border pt-2">
          {cashflow.months.map((month) => (
            <div key={`${month.yearMonth}-label`} className="text-center">
              <p className="text-ui text-foreground">{monthBucketLabel(month.label)}</p>
              <p className="text-meta text-muted-foreground">
                {month.count} {month.count === 1 ? "note" : "notes"}
              </p>
            </div>
          ))}
        </div>

        {upcoming.length > 0 ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
            {upcoming.map((row) => {
              const chip = dueDateChipParts(row.dueDate);
              return (
                <div key={`${row.noteId}-${row.dueDate}`} className="flex items-center gap-3">
                  {chip ? (
                    <span className="w-11 shrink-0 rounded-lg bg-primary/10 py-1 text-center">
                      <span className="block text-meta text-muted-foreground">{chip.month}</span>
                      <span className="block text-ui font-semibold tabular-nums text-foreground">
                        {chip.day}
                      </span>
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ui font-medium text-foreground">
                      {row.issuerName?.trim() || formatNoteReferenceDisplay(row.noteReference)}
                    </p>
                    <p className="text-meta text-muted-foreground">
                      {formatNoteReferenceDisplay(row.noteReference)}
                      {row.tenureDays != null ? ` · ${row.tenureDays}-day tenor` : null}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-ui font-semibold tabular-nums">
                      {formatCurrency(row.amount)}
                    </p>
                    {row.profit > 0 ? (
                      <p className="text-meta tabular-nums text-status-success-text">
                        +{formatCurrency(row.profit)} profit
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <Link href="/investments" className="text-ui font-medium text-primary">
              Full schedule →
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatChartAxisDate(value: string): string {
  return formatNoteDateEnMy(value) ?? value;
}
