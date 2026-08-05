"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { PageShell, useHeader, welcomeBackTitle } from "@cashsouk/ui";

import { Button } from "../components/ui/button";
import { useDashboardStats } from "../hooks/use-dashboard-stats";
import { useCurrentUser } from "../hooks/use-current-user";
import { QuickActionsSection } from "../components/quick-actions-section";
import { OperationsSection } from "../components/operations-section";
import { PlatformSection } from "../components/platform-section";
import { BucketBalancesOverview } from "../components/bucket-balances-overview";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { RequirePermission } from "../components/require-permission";
import { usePermissions } from "../hooks/use-permissions";
import { applicationsKeys } from "../applications/query-keys";
import { notesKeys } from "../notes/query-keys";
import { gatewayPaymentsKeys } from "../hooks/use-gateway-payments";
import { gatewayReconKeys } from "../hooks/use-gateway-recon";
import { cn } from "../lib/utils";

export default function AdminHomePage() {
  const { setTitle } = useHeader();
  useEffect(() => {
    // PageShell owns the title.
    setTitle("");
    return () => setTitle("");
  }, [setTitle]);

  const { can } = usePermissions();
  const canFinance = can("dashboard.finance.view");
  const canOperations = can("dashboard.operations.view");
  const canPlatform = can("dashboard.platform.view");
  const { data: stats, isLoading, isFetching } = useDashboardStats();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [isSpinning, setIsSpinning] = useState(false);

  const displayName = useMemo(() => {
    const user = currentUser?.user;
    if (!user) return "";
    return [user.first_name, user.last_name].filter(Boolean).join(" ");
  }, [currentUser?.user]);

  const isRefreshing = isFetching || isSpinning;

  const handleRefresh = () => {
    setIsSpinning(true);
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "stats"] }),
      queryClient.invalidateQueries({ queryKey: notesKeys.all }),
      queryClient.invalidateQueries({
        queryKey: ["admin", "onboarding-applications", "pending-count"],
      }),
      queryClient.invalidateQueries({ queryKey: applicationsKeys.sidebarAll }),
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
      queryClient.invalidateQueries({ queryKey: gatewayPaymentsKeys.all }),
      queryClient.invalidateQueries({ queryKey: gatewayReconKeys.all }),
    ]).finally(() => {
      window.setTimeout(() => setIsSpinning(false), 500);
    });
  };

  return (
    <RequirePermission permission="dashboard.view">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="p-2 md:p-4">
          <PageShell
            title={welcomeBackTitle(displayName)}
            description="Review queues and platform health from your dashboard."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-11 gap-2 rounded-xl bg-card"
                aria-label="Refresh dashboard"
              >
                <ArrowPathIcon className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            }
          >
            <div className="grid gap-8 lg:grid-cols-[1fr_minmax(17.5rem,30%)] lg:items-start">
              <aside className="min-w-0 lg:sticky lg:top-4 lg:order-2 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:self-start">
                <QuickActionsSection loading={isLoading} />
              </aside>

              <div className="min-w-0 space-y-8 lg:order-1">
                {canFinance && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-primary md:text-2xl">
                        Finance
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Current balances across platform money buckets
                      </p>
                    </div>
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
                        Operational efficiency and processing metrics
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
            </div>
          </PageShell>
        </div>
      </div>
    </RequirePermission>
  );
}
