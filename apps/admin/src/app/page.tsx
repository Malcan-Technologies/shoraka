"use client";

import { useMemo } from "react";

import { useDashboardStats } from "../hooks/use-dashboard-stats";
import { useCurrentUser } from "../hooks/use-current-user";
import { DashboardHeader } from "../components/dashboard/dashboard-header";
import { OperationsSection } from "../components/operations-section";
import { PlatformSection } from "../components/platform-section";
import { BookMetricsRow } from "../components/book-metrics-row";
import { BucketBalancesOverview } from "../components/bucket-balances-overview";
import { RequirePermission } from "../components/require-permission";
import { AdminQueryGate } from "../components/admin-query-error-state";
import { usePermissions } from "../hooks/use-permissions";
import { useQuickActionQueues } from "../hooks/use-quick-action-queues";

export default function AdminHomePage() {
  const { can } = usePermissions();
  const canFinance = can("dashboard.finance.view");
  const canOperations = can("dashboard.operations.view");
  const canPlatform = can("dashboard.platform.view");
  const { data: stats, isLoading, error } = useDashboardStats();
  const { data: currentUser } = useCurrentUser();
  const { queues, needsAttention, ready, description } = useQuickActionQueues({
    loading: isLoading,
  });

  const displayName = useMemo(() => {
    const user = currentUser?.user;
    if (!user) return "";
    return [user.first_name, user.last_name].filter(Boolean).join(" ");
  }, [currentUser?.user]);

  return (
    <RequirePermission permission="dashboard.view">
      <AdminQueryGate error={error} resourceLabel="dashboard statistics">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="p-2 md:p-4">
          <section className="flex min-w-0 flex-col gap-8">
            <header>
              <DashboardHeader
                displayName={displayName}
                description={description}
                queues={queues}
                needsAttention={needsAttention}
                ready={ready}
              />
            </header>

            <div className="space-y-8">
              {canFinance && (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-primary md:text-2xl">
                      Finance
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Where money sits across investor, repayment, and income pools
                    </p>
                  </div>
                  <BookMetricsRow metrics={stats?.bookMetrics} loading={isLoading} />
                  <BucketBalancesOverview />
                </section>
              )}

              {canOperations && (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-primary md:text-2xl">
                      Operations
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Pipeline from onboarding through notes
                    </p>
                  </div>
                  <OperationsSection
                    loading={isLoading}
                    onboarding={stats?.onboardingOperations}
                    applications={stats?.applicationMetrics}
                    contracts={stats?.contractMetrics}
                    notes={stats?.noteMetrics}
                  />
                </section>
              )}

              {canPlatform && (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-primary md:text-2xl">
                      Platform
                    </h2>
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
              )}
            </div>
          </section>
        </div>
      </div>
      </AdminQueryGate>
    </RequirePermission>
  );
}
