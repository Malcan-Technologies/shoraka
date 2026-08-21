"use client";

import { Pie, PieChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

const EM = "\u2014";

/** Donut for financing cards — compact KPI accent or large hero mark. */
export function financingDonutTone(input: {
  fundingStatus?: string | null;
  servicingStatus?: string | null;
}): "primary" | "foreground" {
  const funding = String(input.fundingStatus ?? "").toUpperCase();
  const servicing = String(input.servicingStatus ?? "").toUpperCase();
  if (funding === "FUNDED" || funding === "FAILED" || funding === "CLOSED") {
    return "foreground";
  }
  if (servicing && servicing !== "NOT_STARTED") {
    return "foreground";
  }
  return "primary";
}

export function FinancingDonut({
  percent,
  className,
  size = "sm",
  centerLabel,
  /** primary = funding in progress (brand red). foreground = funding closed / servicing. */
  tone = "primary",
}: {
  /** 0–100. Null/undefined shows an empty ring. */
  percent: number | null | undefined;
  className?: string;
  /** sm: KPI accent (40px). lg: hero mark with centered %. */
  size?: "sm" | "lg";
  /** Shown under the percentage in the hero size (e.g. Utilised). */
  centerLabel?: string;
  tone?: "primary" | "foreground";
}) {
  const rate =
    percent != null && Number.isFinite(percent)
      ? Math.max(0, Math.min(100, percent))
      : null;
  const isHero = size === "lg";
  const filledColor =
    tone === "foreground" ? "hsl(var(--foreground))" : "hsl(var(--primary))";

  const chartConfig = {
    value: { label: "Value" },
    filled: { label: "Filled", color: filledColor },
    remaining: { label: "Remaining", color: "hsl(var(--muted))" },
  } satisfies ChartConfig;

  // Single segment at 0% / 100% avoids the stroke seam at the arc join.
  const chartData =
    rate == null || rate <= 0
      ? [{ name: "remaining", value: 100, fill: "var(--color-remaining)" }]
      : rate >= 100
        ? [{ name: "filled", value: 100, fill: "var(--color-filled)" }]
        : [
            { name: "filled", value: rate, fill: "var(--color-filled)" },
            { name: "remaining", value: 100 - rate, fill: "var(--color-remaining)" },
          ];

  const sizeClass = isHero
    ? "h-[8.5rem] w-[8.5rem] sm:h-[10rem] sm:w-[10rem]"
    : "h-10 w-10";

  return (
    <div className={cn("relative shrink-0", sizeClass, className)}>
      <ChartContainer
        config={chartConfig}
        className="!aspect-square h-full w-full [&_.recharts-pie]:!overflow-visible [&_.recharts-responsive-container]:!h-full [&_.recharts-responsive-container]:!w-full [&_.recharts-wrapper]:!m-0 [&_.recharts-wrapper]:!h-full [&_.recharts-wrapper]:!w-full [&_.recharts-wrapper]:!p-0"
      >
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={isHero ? "64%" : "58%"}
            outerRadius={isHero ? "90%" : "92%"}
            strokeWidth={0}
            paddingAngle={0}
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          />
        </PieChart>
      </ChartContainer>

      {isHero ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <span className="text-2xl font-semibold leading-none tabular-nums tracking-tight text-foreground sm:text-3xl">
            {rate != null ? `${Math.round(rate)}%` : EM}
          </span>
          {centerLabel ? (
            <span className="mt-1.5 text-meta font-normal leading-none text-muted-foreground">
              {centerLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
