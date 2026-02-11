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
  successRate?: number;
  activeFinancing?: number;
  activeNotes?: number;
  completedNotes?: number;
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

export function AccountOverviewCard({
  isDisabled = false,
  successRate = 90,
  activeFinancing = 200000,
  activeNotes = 8,
  completedNotes = 17,
}: AccountOverviewCardProps) {
  const chartData = [
    { name: "success", value: successRate, fill: "var(--color-success)" },
    { name: "remaining", value: 100 - successRate, fill: "var(--color-remaining)" },
  ];

  const formatCurrency = (value: number) => {
    return `RM ${value.toLocaleString("en-MY")}`;
  };

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
                              {successRate}%
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
              <p className="text-2xl font-bold">{formatCurrency(activeFinancing)}</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm text-muted-foreground mb-1">Active notes</p>
              <p className="text-2xl font-bold">{activeNotes}</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm text-muted-foreground mb-1">Completed notes</p>
              <p className="text-2xl font-bold">{completedNotes}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
