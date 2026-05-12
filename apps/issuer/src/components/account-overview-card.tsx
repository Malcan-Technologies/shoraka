"use client";

import { BanknotesIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Label, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartContainer,
  formatMoneyDisplay,
} from "@cashsouk/ui";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
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

function OverviewStatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium leading-6 text-muted-foreground">{label}</p>
      <p className="text-[17px] font-semibold tabular-nums leading-7 text-foreground">{value}</p>
    </div>
  );
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
    <Card className={cn("w-full bg-muted/50 shadow-none", isDisabled && "pointer-events-none opacity-50")}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Account Overview</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
          <div className="relative flex w-full shrink-0 justify-center md:w-[200px] md:max-w-[220px]">
            <div className="pointer-events-auto absolute right-2 top-2 z-10">
              <InfoTooltip
                content="Disbursement success rate (how many financing disbursements succeeded)."
                iconClassName="h-5 w-5"
              />
            </div>
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
            <div className="flex flex-col rounded-xl border border-border bg-background px-4 py-4 shadow-none md:px-5 md:py-5">
              <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
                <BanknotesIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <h3 className="text-lg font-semibold leading-7 text-foreground">Financing</h3>
              </div>
              <div className="flex flex-col gap-5">
                <OverviewStatBlock label="Active financing" value={activeFinancingDisplay} />
                <OverviewStatBlock label="Past financing" value={pastFinancingDisplay} />
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-border bg-background px-4 py-4 shadow-none md:px-5 md:py-5">
              <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
                <DocumentTextIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <h3 className="text-lg font-semibold leading-7 text-foreground">Notes</h3>
              </div>
              <div className="flex flex-col gap-5">
                <OverviewStatBlock label="Active notes" value={activeNotesDisplay} />
                <OverviewStatBlock label="Completed notes" value={completedNotesDisplay} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
