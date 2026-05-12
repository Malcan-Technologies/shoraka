"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartContainer,
  formatMoneyDisplay,
} from "@cashsouk/ui";
import type { ChartConfig } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

interface AccountOverviewCardProps {
  isDisabled?: boolean;
  successRate?: number | null;
  activeFinancing?: number | string | null;
  pastFinancing?: number | string | null;
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

const EM = "\u2014";

function formatDashboardAmount(value: number | string | null | undefined): string {
  if (value == null) return EM;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return EM;
    return formatMoneyDisplay(value);
  }
  const trimmed = value.trim();
  if (!trimmed) return EM;
  const cleaned = trimmed.replace(/^RM\s*/i, "").replace(/,/g, "");
  const n = Number(cleaned);
  if (Number.isNaN(n)) return trimmed;
  return formatMoneyDisplay(n);
}

export function AccountOverviewCard({
  isDisabled = false,
  successRate = null,
  activeFinancing = null,
  pastFinancing = null,
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

  const activeFinancingDisplay = formatDashboardAmount(activeFinancing);
  const pastFinancingDisplay = formatDashboardAmount(pastFinancing);
  const activeNotesDisplay = activeNotes != null && Number.isFinite(activeNotes) ? String(activeNotes) : EM;
  const completedNotesDisplay =
    completedNotes != null && Number.isFinite(completedNotes) ? String(completedNotes) : EM;

  return (
    <Card className={cn("w-full bg-muted/50 shadow-none", isDisabled && "opacity-50 pointer-events-none")}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Account Overview</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
          <div className="flex w-full shrink-0 justify-center md:w-[200px] md:max-w-[220px]">
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
                  innerRadius="62%"
                  outerRadius="88%"
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
                              className="fill-foreground text-lg font-semibold tabular-nums"
                            >
                              {rate != null ? `${rate}%` : EM}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 14}
                              className="fill-muted-foreground text-sm font-normal leading-6"
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

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col rounded-xl border border-border bg-background p-4">
              <p className="mb-3 text-sm font-medium leading-6 text-muted-foreground">Financing</p>
              <div className="flex flex-1 flex-col justify-center space-y-3">
                <p className="text-[17px] leading-7">
                  <span className="text-muted-foreground">Active financing: </span>
                  <span className="font-semibold tabular-nums text-foreground">{activeFinancingDisplay}</span>
                </p>
                <p className="text-[17px] leading-7">
                  <span className="text-muted-foreground">Past financing: </span>
                  <span className="font-semibold tabular-nums text-foreground">{pastFinancingDisplay}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col rounded-xl border border-border bg-background p-4">
              <p className="mb-3 text-sm font-medium leading-6 text-muted-foreground">Notes</p>
              <div className="flex flex-1 flex-col justify-center space-y-3">
                <p className="text-[17px] leading-7">
                  <span className="text-muted-foreground">Active notes: </span>
                  <span className="font-semibold tabular-nums text-foreground">{activeNotesDisplay}</span>
                </p>
                <p className="text-[17px] leading-7">
                  <span className="text-muted-foreground">Completed notes: </span>
                  <span className="font-semibold tabular-nums text-foreground">{completedNotesDisplay}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
