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
  const onTimeDisplay = onTimeRate != null && Number.isFinite(onTimeRate) ? `${onTimeRate}%` : "Not available";
  const pastDueDisplay =
    pastDueCount != null && Number.isFinite(pastDueCount)
      ? `${pastDueCount}`
      : "Not available";
  const lateDisplay =
    lateRepaymentsLastSixMonthsCount != null && Number.isFinite(lateRepaymentsLastSixMonthsCount)
      ? `${lateRepaymentsLastSixMonthsCount}`
      : "Not available";

  return (
    <Card className={cn("w-full bg-muted/50", isDisabled && "opacity-50 pointer-events-none")}>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">Repayment Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-background p-4">
            <p className="text-2xl font-bold mb-1">{onTimeDisplay}</p>
            <p className="text-sm text-muted-foreground">
              On time {onTimePeriod}
            </p>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="text-2xl font-bold mb-1">{pastDueDisplay}</p>
            <p className="text-sm text-muted-foreground">Past due</p>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="text-2xl font-bold mb-1">{lateDisplay}</p>
            <p className="text-sm text-muted-foreground">
              Late {latePeriod}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
