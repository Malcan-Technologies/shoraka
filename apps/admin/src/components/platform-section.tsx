"use client";

import * as React from "react";
import { PlatformStatCard } from "./platform-stat-card";
import { UserSignupsChart } from "./user-signups-chart";
import type { UserStatsWithTrend, PortalOrganizationStats, SignupTrendItem } from "@cashsouk/types";

interface PlatformSectionProps {
  users?: {
    total: UserStatsWithTrend;
    investorsOnboarded: UserStatsWithTrend;
    issuersOnboarded: UserStatsWithTrend;
  };
  organizations?: {
    investor: PortalOrganizationStats;
    issuer: PortalOrganizationStats;
  };
  signupTrends?: SignupTrendItem[];
  loading?: boolean;
}

export function PlatformSection({
  users,
  organizations,
  signupTrends,
  loading = false,
}: PlatformSectionProps) {
  const investorOrgTotal = organizations?.investor.total ?? 0;
  const issuerOrgTotal = organizations?.issuer.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PlatformStatCard
          title="Total Users"
          value={users?.total.current ?? 0}
          percentageChange={users?.total.percentageChange}
          subtitle="vs last month"
          loading={loading}
        />
        <PlatformStatCard
          title="Investor Organizations"
          value={investorOrgTotal}
          percentageChange={users?.investorsOnboarded.percentageChange}
          subtitle="vs last month"
          loading={loading}
        />
        <PlatformStatCard
          title="Issuer Organizations"
          value={issuerOrgTotal}
          percentageChange={users?.issuersOnboarded.percentageChange}
          subtitle="vs last month"
          loading={loading}
        />
      </div>

      {/* Chart Card */}
      <UserSignupsChart data={signupTrends} loading={loading} compact />
    </div>
  );
}
