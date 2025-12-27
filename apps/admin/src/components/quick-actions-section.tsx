"use client";

import * as React from "react";
import { QuickActionCard } from "./quick-action-card";
import { Button } from "./ui/button";
import { ClipboardDocumentCheckIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { usePendingApprovalCount } from "@/hooks/use-pending-approval-count";

interface QuickActionsSectionProps {
  loading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function QuickActionsSection({
  loading = false,
  onRefresh,
  isRefreshing = false,
}: QuickActionsSectionProps) {
  // Fetch real pending approval count from API
  const { data: pendingCountData, isLoading: isPendingCountLoading } = usePendingApprovalCount();
  const pendingOnboardingCount = pendingCountData?.count ?? 0;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
          <p className="text-sm text-muted-foreground">Tasks that need your attention</p>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 p-0 shrink-0"
            title="Refresh quick actions"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="Onboarding Approval"
          description="Review pending KYC/KYB applications"
          count={pendingOnboardingCount}
          countLabel="pending"
          href="/onboarding-approval"
          icon={ClipboardDocumentCheckIcon}
          variant={
            pendingOnboardingCount > 3
              ? "urgent"
              : pendingOnboardingCount > 0
                ? "warning"
                : "default"
          }
          loading={loading || isPendingCountLoading}
        />
        {/* Additional quick actions can be added here in the future */}
      </div>
    </section>
  );
}
