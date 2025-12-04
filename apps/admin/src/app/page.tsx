"use client";

import { UserSignupsChart } from "../components/user-signups-chart";
import { UserStatsCard } from "../components/user-stats-card";
import { SystemHealthIndicator } from "../components/system-health-indicator";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import { useDashboardStats } from "../hooks/use-dashboard-stats";

export default function AdminHomePage() {
  const { data: stats, isLoading } = useDashboardStats();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-8 p-2 md:p-4">
          {/* Users Section */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Users</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <UserStatsCard
                total={stats?.users.total}
                investorsOnboarded={stats?.users.investorsOnboarded}
                issuersOnboarded={stats?.users.issuersOnboarded}
                loading={isLoading}
              />
              <UserSignupsChart data={stats?.signupTrends} loading={isLoading} />
            </div>
          </section>

          {/* Future sections will be added here as features are built:
              - Loans Section (loan applications, approvals, etc.)
              - Investments Section (total investments, active investments, etc.)
              - Payments Section (repayments, disbursements, etc.)
          */}
        </div>
      </div>
    </>
  );
}
