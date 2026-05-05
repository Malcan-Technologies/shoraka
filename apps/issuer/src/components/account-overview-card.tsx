"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartContainer,
} from "@cashsouk/ui";
import type { ChartConfig } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

interface AccountOverviewCardProps {
  isDisabled?: boolean;
  successRate?: number | null;
  activeFinancing?: number | string | null;
  activeNotes?: number | null;
  completedNotes?: number | null;
}

const chartConfig = {
  value: {
    label: "Rate",
  },
  success: {
    label: "Success",
    color: "hsl(var(--foreground))",
  },
  remaining: {
    label: "Remaining",
    color: "hsl(var(--muted))",
  },
} satisfies ChartConfig;

function formatCurrency(value: number) {
  return `RM ${value.toLocaleString("en-MY")}`;
}

export function AccountOverviewCard({
  isDisabled = false,
  successRate = null,
  activeFinancing = null,
  activeNotes = null,
  completedNotes = null,
}: AccountOverviewCardProps) {
  const rate = successRate != null && Number.isFinite(successRate) ? Math.max(0, Math.min(100, successRate)) : null;
  const chartData =
    rate != null
      ? [
          { name: "success", value: rate, fill: "var(--color-success)" },
          { name: "remaining", value: 100 - rate, fill: "var(--color-remaining)" },
        ]
      : [
          { name: "success", value: 0, fill: "var(--color-remaining)" },
          { name: "remaining", value: 100, fill: "var(--color-remaining)" },
        ];

  const activeFinancingDisplay =
    activeFinancing == null
      ? "Not available"
      : typeof activeFinancing === "number"
        ? formatCurrency(activeFinancing)
        : `RM ${activeFinancing}`;

  return (
    <Card className={cn("w-full bg-muted/50", isDisabled && "opacity-50 pointer-events-none")}>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">Account Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-6 md:items-center">
          <div className="flex-shrink-0 md:w-[200px]">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square w-full max-w-[200px] [&_.recharts-pie]:!overflow-visible [&_.recharts-wrapper]:!m-0 [&_.recharts-wrapper]:!p-0"
            >
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
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
                              y={(viewBox.cy || 0) - 6}
                              className="fill-foreground text-2xl font-bold"
                            >
                              {rate != null ? `${rate}%` : "—"}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 16}
                              className="fill-muted-foreground text-xs"
                            >
                              Success rate
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

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm text-muted-foreground mb-1">Active financing</p>
              <p className="text-2xl font-bold">{activeFinancingDisplay}</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm text-muted-foreground mb-1">Active notes</p>
              <p className="text-2xl font-bold">
                {activeNotes != null ? activeNotes : "Not available"}
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm text-muted-foreground mb-1">Completed notes</p>
              <p className="text-2xl font-bold">
                {completedNotes != null ? completedNotes : "Not available"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
