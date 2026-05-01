"use client";

import * as React from "react";
import { QuickActionCard } from "./quick-action-card";
import { Button } from "./ui/button";
import {
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { APPLICATION_ACTION_REQUIRED_STATUS_SET } from "@/applications/action-required-statuses";
import { useAdminApplicationsForSidebar } from "@/hooks/use-admin-applications-for-sidebar";
import { useApplicationActionRequiredCount } from "@/hooks/use-application-action-required-count";
import { usePendingApprovalCount } from "@/hooks/use-pending-approval-count";
import { useNoteActionRequiredCount } from "@/notes/hooks/use-notes";

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
  const { data: applicationActionCountData, isLoading: isApplicationActionCountLoading } =
    useApplicationActionRequiredCount();
  const { data: noteActionCountData, isLoading: isNoteActionCountLoading } = useNoteActionRequiredCount();
  const { data: applicationsForSidebar = [], isLoading: isApplicationsForSidebarLoading } =
    useAdminApplicationsForSidebar();
  const pendingOnboardingCount = pendingCountData?.count ?? 0;
  const applicationActionCount = applicationActionCountData?.count ?? 0;
  const noteActionCount = noteActionCountData?.count ?? 0;
  const firstActionApplication = applicationsForSidebar.find(
    (application) =>
      APPLICATION_ACTION_REQUIRED_STATUS_SET.has(application.status) &&
      (application.baseProductId || application.productId)
  );
  const applicationActionHref = firstActionApplication
    ? `/applications/${firstActionApplication.baseProductId ?? firstActionApplication.productId}`
    : "/";

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-primary md:text-2xl">
            Quick Actions
          </h2>
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
        <QuickActionCard
          title="Application Actions"
          description="Review applications, send offers, and process accepted contracts"
          count={applicationActionCount}
          countLabel="actions"
          href={applicationActionHref}
          icon={DocumentCheckIcon}
          variant={
            applicationActionCount > 5
              ? "urgent"
              : applicationActionCount > 0
                ? "warning"
                : "default"
          }
          loading={loading || isApplicationActionCountLoading || isApplicationsForSidebarLoading}
        />
        <QuickActionCard
          title="Note Actions"
          description="Create, publish, close funding, activate, or review note payments"
          count={noteActionCount}
          countLabel="actions"
          href="/notes"
          icon={DocumentTextIcon}
          variant={
            noteActionCount > 5
              ? "urgent"
              : noteActionCount > 0
                ? "warning"
                : "default"
          }
          loading={loading || isNoteActionCountLoading}
        />
      </div>
    </section>
  );
}
