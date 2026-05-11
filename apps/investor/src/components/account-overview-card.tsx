"use client";

import * as React from "react";
import Link from "next/link";
import { Label, Pie, PieChart } from "recharts";
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Badge,
} from "@cashsouk/ui";
import type { ChartConfig } from "@cashsouk/ui";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useInvestorPortfolio, useInvestorPortfolioHistory } from "@/investments/hooks/use-marketplace-notes";

interface AccountOverviewCardProps {
  isDisabled?: boolean;
}

const chartConfig = {
  value: {
    label: "Amount",
  },
  investment: {
    label: "Total Investment",
    color: "hsl(var(--primary))",
  },
  balance: {
    label: "Available Balance",
    color: "hsl(var(--primary) / 0.3)",
  },
  placeholder: {
    label: "No Data",
    color: "hsl(var(--muted))",
  },
} satisfies ChartConfig;

function formatCurrency(value: number) {
  return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedCurrency(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function buildTrendMetric(currentValue: number, previousValue: number) {
  const deltaAmount = currentValue - previousValue;
  const deltaPercent = previousValue > 0 ? (deltaAmount / previousValue) * 100 : null;

  return {
    deltaAmount,
    deltaPercent,
    direction: deltaAmount > 0 ? "up" : deltaAmount < 0 ? "down" : "flat",
  } as const;
}

function TrendIndicator({
  deltaAmount,
  deltaPercent,
  direction,
}: {
  deltaAmount: number;
  deltaPercent: number | null;
  direction: "up" | "down" | "flat";
}) {
  const toneClassName =
    direction === "up"
      ? "text-green-600"
      : direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  const Icon =
    direction === "up" ? ArrowUpRightIcon : direction === "down" ? ArrowDownRightIcon : ArrowRightIcon;

  return (
    <div className={cn("flex items-center gap-2 mt-8 text-sm", toneClassName)}>
      <Icon className="h-4 w-4" />
      <span>{formatSignedCurrency(deltaAmount)}</span>
      <span className="text-muted-foreground">
        {deltaPercent == null ? "vs 7 days ago" : `${formatSignedPercent(deltaPercent)} vs 7 days ago`}
      </span>
    </div>
  );
}

export function AccountOverviewCard({ isDisabled = false }: AccountOverviewCardProps) {
  const { data: portfolio } = useInvestorPortfolio();
  const { data: weeklyHistory } = useInvestorPortfolioHistory("1W");
  const portfolioTotal = Number(portfolio?.portfolioTotal ?? 0);
  const totalInvestment = Number(portfolio?.totalInvestment ?? 0);
  const availableBalance = Number(portfolio?.availableBalance ?? 0);
  const hasData = portfolioTotal > 0;
  const investmentTrend = React.useMemo(() => {
    const points = weeklyHistory?.points ?? [];
    if (points.length === 0) return buildTrendMetric(totalInvestment, totalInvestment);

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const previousInvestment = firstPoint ? firstPoint.portfolioTotal - firstPoint.availableBalance : totalInvestment;
    const currentInvestment = lastPoint ? lastPoint.portfolioTotal - lastPoint.availableBalance : totalInvestment;
    return buildTrendMetric(currentInvestment, previousInvestment);
  }, [totalInvestment, weeklyHistory?.points]);
  const availableBalanceTrend = React.useMemo(() => {
    const points = weeklyHistory?.points ?? [];
    if (points.length === 0) return buildTrendMetric(availableBalance, availableBalance);

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const previousBalance = firstPoint ? firstPoint.availableBalance : availableBalance;
    const currentBalance = lastPoint ? lastPoint.availableBalance : availableBalance;
    return buildTrendMetric(currentBalance, previousBalance);
  }, [availableBalance, weeklyHistory?.points]);

  // Use placeholder data when there's no real data
  const chartData = hasData
    ? [
        { name: "investment", value: totalInvestment, fill: "var(--color-investment)" },
        { name: "balance", value: availableBalance, fill: "var(--color-balance)" },
      ]
    : [{ name: "placeholder", value: 1, fill: "var(--color-placeholder)" }];

  return (
    <Card className={cn("w-full bg-muted/50", isDisabled && "opacity-50 pointer-events-none")}>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl font-semibold">Account Overview</CardTitle>
        {!isDisabled && (
          <Badge variant="outline" className="text-green-600 border-green-600">
            Active
          </Badge>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row gap-8 lg:items-center">
          {/* Donut Chart - Left Side (30% width) */}
          <div className="flex-shrink-0 lg:w-[30%]">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square w-full max-w-[280px] [&_.recharts-pie]:!overflow-visible [&_.recharts-wrapper]:!m-0 [&_.recharts-wrapper]:!p-0"
            >
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="95%"
                  strokeWidth={3}
                  stroke="hsl(var(--background))"
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) - 8}
                              className="fill-muted-foreground text-xs"
                            >
                              Portfolio size
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 20}
                              className="fill-foreground text-lg font-bold"
                            >
                              {formatCurrency(portfolioTotal)}
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>

          {/* Stats Cards - Right Side (horizontal layout) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 content-center">
            {/* Current Total Investment Card */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Current total investment</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalInvestment)}</p>
              <TrendIndicator {...investmentTrend} />
            </div>

            {/* Available Balance Card */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-primary/30" />
                <span className="text-sm text-muted-foreground">Available balance</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(availableBalance)}</p>
              <TrendIndicator {...availableBalanceTrend} />
            </div>
          </div>
        </div>

        {/* Transaction Details Link */}
        <div className="flex justify-end mt-4">
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Transaction details
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
