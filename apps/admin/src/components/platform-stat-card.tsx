"use client";

import * as React from "react";
import { Card, CardContent, Skeleton } from "@cashsouk/ui";
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/solid";
import { formatNumber } from "@cashsouk/config";
import { cn } from "@/lib/utils";

interface PlatformStatCardProps {
  title: string;
  value: number;
  percentageChange?: number;
  subtitle?: string;
  loading?: boolean;
}

export function PlatformStatCard({
  title,
  value,
  percentageChange,
  subtitle,
  loading = false,
}: PlatformStatCardProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <Skeleton className="h-3.5 w-28 mb-3" />
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-4 w-12" />
          </div>
          {subtitle && <Skeleton className="h-3 w-20 mt-2" />}
        </CardContent>
      </Card>
    );
  }

  const isPositive = percentageChange !== undefined && percentageChange >= 0;
  const showTrend = percentageChange !== undefined;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted-foreground">
          {title}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {formatNumber(value, 0)}
          </span>
          {showTrend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-sm font-medium",
                isPositive ? "text-green-600" : "text-primary"
              )}
            >
              {isPositive ? (
                <ArrowUpIcon className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownIcon className="h-3.5 w-3.5" />
              )}
              {Math.abs(percentageChange)}%
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
