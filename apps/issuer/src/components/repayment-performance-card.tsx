"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

interface RepaymentPerformanceCardProps {
  isDisabled?: boolean;
  onTimeRate?: number | null;
  onTimePeriod?: string;
  pastDueDays?: number | null;
  lateDays?: number | null;
  latePeriod?: string;
}

export function RepaymentPerformanceCard({
  isDisabled = false,
  onTimeRate = null,
  onTimePeriod = "over the past 6 months",
  pastDueDays = null,
  lateDays = null,
  latePeriod = "over the past 6 months",
}: RepaymentPerformanceCardProps) {
  const onTimeDisplay = onTimeRate != null && Number.isFinite(onTimeRate) ? `${onTimeRate}%` : "Not available";
  const pastDueDisplay =
    pastDueDays != null && Number.isFinite(pastDueDays)
      ? `${pastDueDays} ${pastDueDays === 1 ? "Day" : "Days"}`
      : "Not available";
  const lateDisplay =
    lateDays != null && Number.isFinite(lateDays)
      ? `${lateDays} ${lateDays === 1 ? "Day" : "Days"}`
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
              <br />
              (on average)
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
              <br />
              (on average)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
