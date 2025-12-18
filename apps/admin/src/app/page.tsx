"use client";

import { SystemHealthIndicator } from "../components/system-health-indicator";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import { Button } from "../components/ui/button";
import { useDashboardStats } from "../hooks/use-dashboard-stats";
import { QuickActionsSection } from "../components/quick-actions-section";
import { OperationsSection } from "../components/operations-section";
import { PlatformSection } from "../components/platform-section";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

export default function AdminHomePage() {
  const { data: stats, isLoading, refetch, isFetching } = useDashboardStats();

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
          <QuickActionsSection
            loading={isLoading}
            onRefresh={() => refetch()}
            isRefreshing={isFetching}
          />

          {/* Operations Section */}
          <section className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Operations (Placeholder)</h2>
                <p className="text-sm text-muted-foreground">
                  Operational efficiency and processing metrics
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 w-8 p-0 shrink-0"
                title="Refresh operations data"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <OperationsSection loading={isLoading} />
          </section>

          {/* Platform Overview Section */}
          <section className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Platform</h2>
                <p className="text-sm text-muted-foreground">Users and organization statistics</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 w-8 p-0 shrink-0"
                title="Refresh platform data"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
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
