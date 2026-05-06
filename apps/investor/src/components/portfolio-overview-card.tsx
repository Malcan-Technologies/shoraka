"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useInvestorInvestments, useInvestorPortfolio } from "@/investments/hooks/use-marketplace-notes";

const RANGE_OPTIONS = ["3m", "6m", "1y", "3y", "5y", "all time"] as const;

type RangeOption = (typeof RANGE_OPTIONS)[number];

function formatCurrency(value: number) {
  return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildSyntheticPerformance(total: number) {
  const safeTotal = total > 0 ? total : 100000;
  const monthLabels = ["Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26"];
  const multipliers = [0.72, 0.79, 0.84, 0.88, 0.93, 1];
  return monthLabels.map((month, index) => ({
    month,
    value: Number((safeTotal * multipliers[index]).toFixed(2)),
  }));
}

export function PortfolioOverviewCard() {
  const [activeRange, setActiveRange] = useState<RangeOption>("6m");
  const { data: portfolio } = useInvestorPortfolio();
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

  const chartData = useMemo(() => buildSyntheticPerformance(portfolioTotal), [portfolioTotal]);

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
            <LineChart data={chartData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                labelFormatter={(value) => `Month: ${value}`}
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
              key={option}
              type="button"
              onClick={() => setActiveRange(option)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeRange === option
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {option}
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
