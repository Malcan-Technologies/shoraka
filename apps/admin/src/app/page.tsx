"use client";

import { SystemHealthIndicator } from "../components/system-health-indicator";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import { useDashboardStats } from "../hooks/use-dashboard-stats";
import { QuickActionsSection } from "../components/quick-actions-section";
import { PlatformSection } from "../components/platform-section";

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
          {/* Quick Actions Section */}
          <QuickActionsSection loading={isLoading} />

          {/* Platform Overview Section */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Platform</h2>
              <p className="text-sm text-muted-foreground">
                Users and organization statistics
              </p>
            </div>
            <PlatformSection
              users={stats?.users}
              organizations={stats?.organizations}
              signupTrends={stats?.signupTrends}
              loading={isLoading}
            />
          </section>
        </div>
      </div>
    </>
  );
}
