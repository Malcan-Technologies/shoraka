"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Skeleton,
} from "@cashsouk/ui";
import type { SignupTrendItem } from "@cashsouk/types";

interface UserSignupsChartProps {
  data?: SignupTrendItem[];
  loading?: boolean;
  compact?: boolean;
}

// Brand colors from BRANDING.md
const chartConfig = {
  totalSignups: {
    label: "User Signups",
    color: "#8A0304", // Primary Brand - Deep corporate red
  },
  investorOrgsOnboarded: {
    label: "Investor Orgs Onboarded",
    color: "#6F4924", // Earth Brown
  },
  issuerOrgsOnboarded: {
    label: "Issuer Orgs Onboarded",
    color: "#BAA38B", // Sand Taupe
  },
} satisfies ChartConfig;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function UserSignupsChart({ data, loading, compact = false }: UserSignupsChartProps) {
  const chartHeight = compact ? 250 : 300;

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height: chartHeight }} />
        </CardContent>
      </Card>
    );
  }

  const chartData = data || [];
  const hasData = chartData.some(
    (item) =>
      item.totalSignups > 0 || item.investorOrgsOnboarded > 0 || item.issuerOrgsOnboarded > 0
  );

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Signups & Onboarding</CardTitle>
        <CardDescription className="text-xs">Daily trends over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div
            className="flex items-center justify-center text-muted-foreground text-sm"
            style={{ height: chartHeight }}
          >
            No signup data available for this period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
            <AreaChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
                top: 12,
                bottom: 12,
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatDate}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(label) => formatDate(label)}
                  />
                }
              />
              <defs>
                <linearGradient id="fillTotalSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-totalSignups)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-totalSignups)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillInvestorOrgsOnboarded" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-investorOrgsOnboarded)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-investorOrgsOnboarded)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillIssuerOrgsOnboarded" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-issuerOrgsOnboarded)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-issuerOrgsOnboarded)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <Area
                dataKey="totalSignups"
                type="monotone"
                fill="url(#fillTotalSignups)"
                fillOpacity={0.4}
                stroke="var(--color-totalSignups)"
                strokeWidth={2}
              />
              <Area
                dataKey="investorOrgsOnboarded"
                type="monotone"
                fill="url(#fillInvestorOrgsOnboarded)"
                fillOpacity={0.4}
                stroke="var(--color-investorOrgsOnboarded)"
                strokeWidth={2}
              />
              <Area
                dataKey="issuerOrgsOnboarded"
                type="monotone"
                fill="url(#fillIssuerOrgsOnboarded)"
                fillOpacity={0.4}
                stroke="var(--color-issuerOrgsOnboarded)"
                strokeWidth={2}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
