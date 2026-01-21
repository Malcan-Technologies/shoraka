"use client";

import * as React from "react";
import Link from "next/link";
import { Label, Pie, PieChart } from "recharts";
import { ArrowUpRightIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
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

interface AccountOverviewCardProps {
  isDisabled?: boolean;
}

const chartConfig = {
  value: {
    label: "Amount",
  },
  raised: {
    label: "Total Raised",
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

export function AccountOverviewCard({ isDisabled = false }: AccountOverviewCardProps) {
  const portfolioTotal = 0;
  const totalRaised = 0;
  const availableBalance = 0;
  const hasData = portfolioTotal > 0;

  // Use placeholder data when there's no real data
  const chartData = hasData
    ? [
        { name: "raised", value: totalRaised, fill: "var(--color-raised)" },
        { name: "balance", value: availableBalance, fill: "var(--color-balance)" },
      ]
    : [{ name: "placeholder", value: 1, fill: "var(--color-placeholder)" }];

  const formatCurrency = (value: number) => {
    return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

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
            {/* Current Total Raised Card */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Current total raised</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalRaised)}</p>
              <div className="flex items-center gap-2 mt-8 text-sm text-green-600">
                <ArrowUpRightIcon className="h-4 w-4" />
                <span>0</span>
                <span className="text-muted-foreground">+0% this week</span>
              </div>
            </div>

            {/* Available Balance Card */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-primary/30" />
                <span className="text-sm text-muted-foreground">Available balance</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(availableBalance)}</p>
              <div className="flex items-center gap-2 mt-8 text-sm text-green-600">
                <ArrowUpRightIcon className="h-4 w-4" />
                <span>0</span>
                <span className="text-muted-foreground">+0% this week</span>
              </div>
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
