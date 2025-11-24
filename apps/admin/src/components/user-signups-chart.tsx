"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
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
} from "@cashsouk/ui";

const chartData = [
  { month: "January", investors: 186, borrowers: 80 },
  { month: "February", investors: 305, borrowers: 200 },
  { month: "March", investors: 237, borrowers: 120 },
  { month: "April", investors: 73, borrowers: 190 },
  { month: "May", investors: 209, borrowers: 130 },
  { month: "June", investors: 214, borrowers: 140 },
];

const chartConfig = {
  investors: {
    label: "Investors",
    color: "hsl(var(--chart-1))",
  },
  borrowers: {
    label: "Borrowers",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function UserSignupsChart() {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>User Signups</CardTitle>
        <CardDescription>
          Monthly investor and borrower registration trends
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <defs>
              <linearGradient id="fillInvestors" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-investors)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-investors)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillBorrowers" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-borrowers)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-borrowers)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <Area
              dataKey="borrowers"
              type="natural"
              fill="url(#fillBorrowers)"
              fillOpacity={0.4}
              stroke="var(--color-borrowers)"
              stackId="a"
            />
            <Area
              dataKey="investors"
              type="natural"
              fill="url(#fillInvestors)"
              fillOpacity={0.4}
              stroke="var(--color-investors)"
              stackId="a"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

