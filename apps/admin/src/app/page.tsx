"use client";

import { useMemo } from "react";

import { useDashboardStats } from "../hooks/use-dashboard-stats";
import { useCurrentUser } from "../hooks/use-current-user";
import { DashboardHeader } from "../components/dashboard/dashboard-header";
import { DashboardNextActions } from "../components/dashboard/dashboard-next-actions";
import { OperationsSection } from "../components/operations-section";
import { PlatformSection } from "../components/platform-section";
import { BookMetricsRow } from "../components/book-metrics-row";
import { DashboardCreditQuality } from "../components/dashboard/dashboard-credit-quality";
import { MoneyOnPlatform } from "../components/dashboard/money-on-platform";
import { RequirePermission } from "../components/require-permission";
import { AdminQueryGate } from "../components/admin-query-error-state";
import { usePermissions } from "../hooks/use-permissions";
import { useQuickActionQueues } from "../hooks/use-quick-action-queues";
import { useNoteBucketBalances } from "../notes/hooks/use-notes";

export default function AdminHomePage() {
  const { can } = usePermissions();
  const canFinance = can("dashboard.finance.view");
  const canOperations = can("dashboard.operations.view");
  const canPlatform = can("dashboard.platform.view");
  const canDashboardReports = can("dashboard.reports.view");
  // Summary cards follow dashboard.* permissions only; the stats API returns just these sections.
  const hasStatsSection = canFinance || canOperations || canPlatform || canDashboardReports;
  const { data: stats, isLoading, error, dataUpdatedAt } = useDashboardStats({
    enabled: hasStatsSection,
  });
  const buckets = useNoteBucketBalances({ enabled: canFinance, refetchInterval: 60_000 });
  const { data: currentUser } = useCurrentUser();
  const { queues, needsAttention, ready, totalOpenItems, description } = useQuickActionQueues({
    loading: isLoading,
  });

  const displayName = useMemo(() => {
    const user = currentUser?.user;
    if (!user) return "";
    return [user.first_name, user.last_name].filter(Boolean).join(" ");
  }, [currentUser?.user]);

  const par90Percent = stats?.portfolioAtRisk?.par90.percent;

  return (
    <RequirePermission permission="dashboard.view">
      <AdminQueryGate error={error} resourceLabel="dashboard statistics">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="p-2 md:p-4">
          <section className="flex min-w-0 flex-col gap-7">
            <DashboardHeader
              displayName={displayName}
              description={description}
              dataUpdatedAt={dataUpdatedAt}
              workQueued={
                ready
                  ? { status: "ready", value: { items: totalOpenItems, queues: needsAttention.length } }
                  : { status: "loading" }
              }
              ledger={
                !canFinance
                  ? { status: "hidden" }
                  : buckets.isLoading
                    ? { status: "loading" }
                    : buckets.data
                      ? { status: "ready", value: { balance: buckets.data.totals.balance } }
                      : { status: "hidden" }
              }
              par90={
                !canDashboardReports
                  ? { status: "hidden" }
                  : isLoading
                    ? { status: "loading" }
                    : par90Percent != null
                      ? { status: "ready", value: { percent: par90Percent } }
                      : { status: "hidden" }
              }
              distressed={
                !canFinance
                  ? { status: "hidden" }
                  : isLoading
                    ? { status: "loading" }
                    : stats?.bookMetrics
                      ? {
                          status: "ready",
                          value: {
                            arrears: stats.bookMetrics.arrears.count,
                            defaulted: stats.bookMetrics.defaulted.count,
                          },
                        }
                      : { status: "hidden" }
              }
            />

            <DashboardNextActions
              queues={queues}
              needsAttention={needsAttention}
              ready={ready}
              totalOpenItems={totalOpenItems}
            />

            {canFinance ? (
              <>
                <BookMetricsRow
                  metrics={stats?.bookMetrics}
                  history={stats?.bookMetricHistory}
                  loading={isLoading}
                />
                <MoneyOnPlatform />
              </>
            ) : null}

            {canDashboardReports ? (
              <DashboardCreditQuality summary={stats?.portfolioAtRisk} loading={isLoading} />
            ) : null}

            {canOperations ? (
              <OperationsSection
                loading={isLoading}
                onboarding={stats?.onboardingOperations}
                applications={stats?.applicationMetrics}
                contracts={stats?.contractMetrics}
                notes={stats?.noteMetrics}
              />
            ) : null}

            {canPlatform ? (
              <PlatformSection
                users={stats?.users}
                organizations={stats?.organizations}
                signupTrends={stats?.signupTrends}
                loading={isLoading}
              />
            ) : null}
          </section>
        </div>
      </div>
      </AdminQueryGate>
    </RequirePermission>
  );
}
