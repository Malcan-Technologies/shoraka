"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Skeleton,
} from "@cashsouk/ui";
import { ClockIcon, DocumentCheckIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

// Brand colors from BRANDING.md
const chartConfig = {
  applications: {
    label: "Applications",
  },
  pending: {
    label: "Pending",
    color: "#F59E0B", // Amber
  },
  approved: {
    label: "Approved",
    color: "#22C55E", // Green
  },
  rejected: {
    label: "Rejected",
    color: "#8A0304", // Primary Brand Red
  },
} satisfies ChartConfig;

interface OnboardingApprovalMetrics {
  pending: number;
  approved: number;
  rejected: number;
  avgTimeToApproval: string;
  avgTimeChange: number;
}

interface OperationsSectionProps {
  loading?: boolean;
}

// Mock data for onboarding approval metrics
const MOCK_ONBOARDING_METRICS: OnboardingApprovalMetrics = {
  pending: 5,
  approved: 47,
  rejected: 8,
  avgTimeToApproval: "2.4h",
  avgTimeChange: -15,
};

export function OperationsSection({ loading = false }: OperationsSectionProps) {
  const metrics = MOCK_ONBOARDING_METRICS;
  const total = metrics.pending + metrics.approved + metrics.rejected;

  const chartData = [
    { status: "pending", count: metrics.pending, fill: "var(--color-pending)" },
    { status: "approved", count: metrics.approved, fill: "var(--color-approved)" },
    { status: "rejected", count: metrics.rejected, fill: "var(--color-rejected)" },
  ];

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <Skeleton className="h-[200px] w-[200px] rounded-full" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isTimeImproved = metrics.avgTimeChange < 0;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <DocumentCheckIcon className="h-5 w-5 text-muted-foreground" />
          Onboarding Approval
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Donut Chart */}
          <div className="flex-shrink-0">
            <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[200px]">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={60}
                  outerRadius={85}
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
                              y={viewBox.cy}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {total}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 20}
                              className="fill-muted-foreground text-xs"
                            >
                              Total
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

          {/* Stats */}
          <div className="flex-1 w-full space-y-4">
            {/* Legend / Breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-xl bg-muted/50">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">Pending</span>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {metrics.pending}
                </span>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/50">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-xs font-medium text-muted-foreground">Approved</span>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {metrics.approved}
                </span>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/50">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Rejected</span>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {metrics.rejected}
                </span>
              </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Average Time to Approval */}
              <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted shrink-0">
                  <ClockIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Avg. Time to Approval
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground tabular-nums">
                      {metrics.avgTimeToApproval}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isTimeImproved ? "text-green-600" : "text-primary"
                      )}
                    >
                      {isTimeImproved ? "↓" : "↑"} {Math.abs(metrics.avgTimeChange)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">vs last 7 days</p>
                </div>
              </div>

              {/* Rejection Rate */}
              <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <XCircleIcon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Rejection Rate
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground tabular-nums">
                      {((metrics.rejected / (metrics.approved + metrics.rejected)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">of processed applications</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
