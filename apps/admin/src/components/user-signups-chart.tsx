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
}

// Brand colors from BRANDING.md
const chartConfig = {
  totalSignups: {
    label: "Total Signups",
    color: "#8A0304", // Primary Brand - Deep corporate red
  },
  investorsOnboarded: {
    label: "Investors Onboarded",
    color: "#6F4924", // Earth Brown
  },
  issuersOnboarded: {
    label: "Issuers Onboarded",
    color: "#BAA38B", // Sand Taupe
  },
} satisfies ChartConfig;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function UserSignupsChart({ data, loading }: UserSignupsChartProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm h-full">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data || [];
  const hasData = chartData.some(
    (item) => item.totalSignups > 0 || item.investorsOnboarded > 0 || item.issuersOnboarded > 0
  );

  return (
    <Card className="rounded-2xl shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">User Signup & Onboarding</CardTitle>
        <CardDescription className="text-xs">Daily trends over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
            No signup data available for this period
          </div>
        ) : (
          <ChartContainer config={chartConfig}>
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
                <linearGradient id="fillInvestorsOnboarded" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-investorsOnboarded)" stopOpacity={0.8} />
                  <stop
                    offset="95%"
                    stopColor="var(--color-investorsOnboarded)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillIssuersOnboarded" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-issuersOnboarded)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-issuersOnboarded)" stopOpacity={0.1} />
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
                dataKey="investorsOnboarded"
                type="monotone"
                fill="url(#fillInvestorsOnboarded)"
                fillOpacity={0.4}
                stroke="var(--color-investorsOnboarded)"
                strokeWidth={2}
              />
              <Area
                dataKey="issuersOnboarded"
                type="monotone"
                fill="url(#fillIssuersOnboarded)"
                fillOpacity={0.4}
                stroke="var(--color-issuersOnboarded)"
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
