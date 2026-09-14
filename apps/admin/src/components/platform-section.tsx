"use client";

import Link from "next/link";
import { PlatformStatCard } from "./platform-stat-card";
import { UserSignupsChart } from "./user-signups-chart";
import type { UserStatsWithTrend, PortalOrganizationStats, SignupTrendItem } from "@cashsouk/types";
import { usePermissions } from "@/hooks/use-permissions";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";

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
  const { can } = usePermissions();
  const investorOrgTotal = organizations?.investor.total ?? 0;
  const issuerOrgTotal = organizations?.issuer.total ?? 0;

  return (
    <section>
      <DashboardSectionHeader
        title="Platform"
        subtitle="Users and organisations, last 30 days"
        action={
          can("users.view") ? (
            <Link href="/accounts" className="text-ui font-medium text-primary hover:text-accent">
              User accounts →
            </Link>
          ) : null
        }
      />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] xl:items-stretch">
        <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <PlatformStatCard
            title="Total users"
            value={users?.total.current ?? 0}
            percentageChange={users?.total.percentageChange}
            subtitle="vs last month"
            loading={loading}
          />
          <PlatformStatCard
            title="Investor orgs"
            value={investorOrgTotal}
            percentageChange={organizations?.investor.percentageChange}
            subtitle="vs last month"
            loading={loading}
          />
          <PlatformStatCard
            title="Issuer orgs"
            value={issuerOrgTotal}
            percentageChange={organizations?.issuer.percentageChange}
            subtitle="vs last month"
            loading={loading}
          />
        </div>
        <UserSignupsChart data={signupTrends} loading={loading} compact />
      </div>
    </section>
  );
}
