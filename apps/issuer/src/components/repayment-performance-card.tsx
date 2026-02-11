"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@cashsouk/ui";
import { cn } from "@/lib/utils";

interface RepaymentPerformanceCardProps {
  isDisabled?: boolean;
  onTimeRate?: number;
  onTimePeriod?: string;
  pastDueDays?: number;
  lateDays?: number;
  latePeriod?: string;
}

export function RepaymentPerformanceCard({
  isDisabled = false,
  onTimeRate = 90,
  onTimePeriod = "over the past 6 months",
  pastDueDays = 1,
  lateDays = 3,
  latePeriod = "over the past 6 months",
}: RepaymentPerformanceCardProps) {
  return (
    <Card className={cn("w-full bg-muted/50", isDisabled && "opacity-50 pointer-events-none")}>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">Repayment Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-background p-4">
            <p className="text-2xl font-bold mb-1">{onTimeRate}%</p>
            <p className="text-sm text-muted-foreground">
              On time {onTimePeriod}
              <br />
              (on average)
            </p>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="text-2xl font-bold mb-1">
              {pastDueDays} {pastDueDays === 1 ? "Day" : "Days"}
            </p>
            <p className="text-sm text-muted-foreground">Past due</p>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="text-2xl font-bold mb-1">
              {lateDays} {lateDays === 1 ? "Day" : "Days"}
            </p>
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
