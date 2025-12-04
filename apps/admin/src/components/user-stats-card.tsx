"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Button,
} from "@cashsouk/ui";
import {
  UsersIcon,
  UserPlusIcon,
  BuildingOfficeIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { formatNumber } from "@cashsouk/config";
import type { UserStatsWithTrend } from "@cashsouk/types";
import Link from "next/link";

interface UserStatsCardProps {
  total?: UserStatsWithTrend;
  investorsOnboarded?: UserStatsWithTrend;
  issuersOnboarded?: UserStatsWithTrend;
  loading?: boolean;
}

function TrendBadge({ percentageChange }: { percentageChange: number }) {
  const isPositive = percentageChange >= 0;
  const sign = isPositive ? "+" : "";
  
  return (
    <span
      className={`text-xs font-medium ${
        isPositive ? "text-green-600" : "text-red-600"
      }`}
    >
      {sign}{percentageChange}%
    </span>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  percentageChange,
  loading,
}: {
  icon: typeof UsersIcon;
  label: string;
  value: number;
  percentageChange?: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">{formatNumber(value, 0)}</span>
        {percentageChange !== undefined && (
          <TrendBadge percentageChange={percentageChange} />
        )}
      </div>
    </div>
  );
}

export function UserStatsCard({
  total,
  investorsOnboarded,
  issuersOnboarded,
  loading,
}: UserStatsCardProps) {
  return (
    <Card className="rounded-2xl shadow-sm h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-medium">User Overview</CardTitle>
            <p className="text-xs text-muted-foreground">Last 30 days comparison</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="h-8 px-3 text-muted-foreground hover:bg-primary hover:text-primary-foreground shrink-0">
            <Link href="/users" className="inline-flex items-center gap-1">
              <span>View All</span>
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <StatRow
          icon={UsersIcon}
          label="Total Users"
          value={total?.current ?? 0}
          percentageChange={total?.percentageChange}
          loading={loading}
        />
        <div className="border-t" />
        <StatRow
          icon={UserPlusIcon}
          label="Investors Onboarded"
          value={investorsOnboarded?.current ?? 0}
          percentageChange={investorsOnboarded?.percentageChange}
          loading={loading}
        />
        <div className="border-t" />
        <StatRow
          icon={BuildingOfficeIcon}
          label="Issuers Onboarded"
          value={issuersOnboarded?.current ?? 0}
          percentageChange={issuersOnboarded?.percentageChange}
          loading={loading}
        />
      </CardContent>
    </Card>
  );
}

