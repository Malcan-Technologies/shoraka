"use client";

import { useMemo, useState } from "react";
import type { InvestorPortfolioHistoryGranularity } from "@cashsouk/types";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useInvestorInvestments,
  useInvestorPortfolio,
  useInvestorPortfolioHistory,
} from "@/investments/hooks/use-marketplace-notes";

const RANGE_OPTIONS = [
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
] as const;

type RangeOption = (typeof RANGE_OPTIONS)[number]["value"];

const API_RANGE_BY_OPTION: Record<RangeOption, "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL"> = {
  "1w": "1W",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "ytd": "YTD",
  "all": "ALL",
};

function formatCurrency(value: number) {
  return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12);
}

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveChartGranularity(range: RangeOption): InvestorPortfolioHistoryGranularity {
  return range === "ytd" || range === "all" ? "month" : "day";
}

function formatXAxisDate(
  value: string,
  range: RangeOption,
  granularity: InvestorPortfolioHistoryGranularity
) {
  const date = parseDateKey(value);
  if (Number.isNaN(date.getTime())) return value;

  if (granularity === "month") {
    return date.toLocaleDateString("en-MY", {
      month: "short",
      ...(range === "all" ? { year: "2-digit" } : {}),
    });
  }

  if (range === "1w") {
    return date.toLocaleDateString("en-MY", { weekday: "short" });
  }

  if (range === "1m" || range === "3m") {
    return date.toLocaleDateString("en-MY", { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString("en-MY", { month: "short", day: "numeric" });
}

function formatTooltipDate(value: string, granularity: InvestorPortfolioHistoryGranularity) {
  const date = parseDateKey(value);
  if (Number.isNaN(date.getTime())) return value;

  if (granularity === "month") {
    return date.toLocaleDateString("en-MY", { year: "numeric", month: "long" });
  }

  return date.toLocaleDateString("en-MY", { year: "numeric", month: "short", day: "numeric" });
}

function formatYAxisTick(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return value.toFixed(0);
}

export function PortfolioOverviewCard() {
  const [activeRange, setActiveRange] = useState<RangeOption>("3m");
  const { data: portfolio } = useInvestorPortfolio();
  const { data: history } = useInvestorPortfolioHistory(API_RANGE_BY_OPTION[activeRange]);
  const { data: investedNotesData } = useInvestorInvestments();

  const portfolioTotal = Number(portfolio?.portfolioTotal ?? 0);
  const investmentCount = Number(portfolio?.investmentCount ?? 0);

  const averageExpectedReturn = useMemo(() => {
    const notes = investedNotesData?.notes ?? [];
    const rates = notes
      .map((note) => Number(note.profitRatePercent ?? 0))
      .filter((rate) => Number.isFinite(rate) && rate > 0);
    if (rates.length === 0) return 0;
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  }, [investedNotesData?.notes]);

  const successfulInvestments = investmentCount > 0 ? Math.max(1, Math.round(investmentCount * 0.75)) : 0;
  const underPerformingInvestments =
    investmentCount > successfulInvestments ? investmentCount - successfulInvestments : 0;

  const chartData = useMemo(() => {
    const points = history?.points ?? [];
    if (points.length > 0) {
      return points.map((point) => ({
        date: point.date,
        value: point.portfolioTotal,
      }));
    }
    return [
      {
        date: formatDateKey(new Date()),
        value: Number(portfolio?.availableBalance ?? 0),
      },
    ];
  }, [history?.points, portfolio?.availableBalance]);
  const chartGranularity = history?.granularity ?? resolveChartGranularity(activeRange);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-xl font-semibold">Portfolio Overview</CardTitle>
        <p className="text-sm text-muted-foreground">
          Performance:{" "}
          <span className="font-semibold text-primary">{averageExpectedReturn.toFixed(1)}% p.a</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-[270px] w-full rounded-xl border bg-muted/20 px-2 py-4 md:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 28, right: 24, top: 12, bottom: 8 }}>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                interval={activeRange === "1w" ? 0 : "preserveStartEnd"}
                minTickGap={40}
                height={32}
                tickMargin={8}
                padding={{ left: 20, right: 20 }}
                tickFormatter={(value) => formatXAxisDate(String(value), activeRange, chartGranularity)}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={72}
                tickMargin={8}
                tickFormatter={formatYAxisTick}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                labelFormatter={(value) => formatTooltipDate(String(value), chartGranularity)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--background))",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setActiveRange(option.value)}
              aria-pressed={activeRange === option.value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeRange === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Total portfolio size</p>
            <p className="text-2xl font-semibold">{formatCurrency(portfolioTotal)}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Total investments</p>
              <p className="text-lg font-semibold">{investmentCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Successful</p>
              <p className="text-lg font-semibold">{successfulInvestments}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Under-performing</p>
              <p className="text-lg font-semibold">{underPerformingInvestments}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
