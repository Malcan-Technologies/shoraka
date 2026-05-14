"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

interface RepaymentPerformanceCardProps {
  isDisabled?: boolean;
  onTimeRate?: number | null;
  onTimePeriod?: string;
  pastDueCount?: number | null;
  lateRepaymentsLastSixMonthsCount?: number | null;
  latePeriod?: string;
}

export function RepaymentPerformanceCard({
  isDisabled = false,
  onTimeRate = null,
  onTimePeriod = "over the past 6 months",
  pastDueCount = null,
  lateRepaymentsLastSixMonthsCount = null,
  latePeriod = "over the past 6 months",
}: RepaymentPerformanceCardProps) {
  const em = "\u2014";
  const onTimeDisplay = onTimeRate != null && Number.isFinite(onTimeRate) ? `${onTimeRate}%` : em;
  const pastDueDisplay =
    pastDueCount != null && Number.isFinite(pastDueCount) ? `${pastDueCount}` : em;
  const lateDisplay =
    lateRepaymentsLastSixMonthsCount != null && Number.isFinite(lateRepaymentsLastSixMonthsCount)
      ? `${lateRepaymentsLastSixMonthsCount}`
      : em;

  return (
    <Card className={cn("w-full bg-muted/50 shadow-none", isDisabled && "opacity-50 pointer-events-none")}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Repayment Performance</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-lg font-semibold tabular-nums text-foreground">{onTimeDisplay}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">On time {onTimePeriod}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-lg font-semibold tabular-nums text-foreground">{pastDueDisplay}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Past due</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-lg font-semibold tabular-nums text-foreground">{lateDisplay}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Late {latePeriod}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
