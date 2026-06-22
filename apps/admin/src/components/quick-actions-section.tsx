"use client";

import * as React from "react";
import { QuickActionCard } from "./quick-action-card";
import { Button } from "./ui/button";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
  ClipboardDocumentCheckIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { APPLICATION_ACTION_REQUIRED_STATUS_SET } from "@/applications/action-required-statuses";
import {
  activeProductBaseKeySet,
  activeProductPendingActionTotal,
  buildApplicationSidebarGroups,
} from "@/applications/application-nav-groups";
import { useAdminApplicationsForSidebar } from "@/hooks/use-admin-applications-for-sidebar";
import { usePendingApprovalCount } from "@/hooks/use-pending-approval-count";
import { useProducts } from "@/hooks/use-products";
import {
  useNoteActionRequiredCount,
  usePendingInvestorWithdrawals,
  usePendingRepayments,
  usePendingIssuerPayouts,
  usePendingServiceFeeTrusteeLetters,
} from "@/notes/hooks/use-notes";
import { usePermissions } from "@/hooks/use-permissions";

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
  const { can } = usePermissions();
  const canOnboarding = can("onboarding.view");
  const canApplications = can("applications.view");
  const canNotes = can("notes.view");
  const canRepayments = can("repayments.view");
  const canServiceFee = can("service_fee.view");
  const canDisbursements = can("disbursements.view");
  const canViewInvestorWithdrawals = can("investor_withdrawals.view");

  const { data: pendingCountData, isLoading: isPendingCountLoading } = usePendingApprovalCount({ enabled: canOnboarding });
  const { data: noteActionCountData, isLoading: isNoteActionCountLoading } = useNoteActionRequiredCount({ enabled: canNotes });
  const { data: pendingRepaymentsData, isLoading: isPendingRepaymentsLoading } = usePendingRepayments({ enabled: canRepayments });
  const { data: pendingIssuerPayoutsData, isLoading: isPendingIssuerPayoutsLoading } =
    usePendingIssuerPayouts({ enabled: canDisbursements });
  const { data: pendingInvestorWithdrawalsData, isLoading: isPendingInvestorWithdrawalsLoading } =
    usePendingInvestorWithdrawals({ enabled: canViewInvestorWithdrawals });
  const { data: pendingServiceFeeLettersData, isLoading: isPendingServiceFeeLettersLoading } =
    usePendingServiceFeeTrusteeLetters({ enabled: canServiceFee });
  const { data: applicationsForSidebar = [], isLoading: isApplicationsForSidebarLoading } =
    useAdminApplicationsForSidebar({ enabled: canApplications });
  const { data: productsData, isLoading: isProductsLoading } = useProducts({
    page: 1,
    pageSize: 100,
    includeDeleted: true,
    enabled: canApplications,
  });
  const pendingOnboardingCount = pendingCountData?.count ?? 0;
  const applicationNavGroups = React.useMemo(
    () => buildApplicationSidebarGroups(productsData?.products ?? [], applicationsForSidebar),
    [productsData?.products, applicationsForSidebar]
  );
  const applicationActionCount = activeProductPendingActionTotal(applicationNavGroups);
  const noteActionCount = noteActionCountData?.count ?? 0;
  const pendingRepaymentsCount = pendingRepaymentsData?.count ?? 0;
  const pendingIssuerPayoutsCount = pendingIssuerPayoutsData?.count ?? 0;
  const pendingInvestorWithdrawalsCount = pendingInvestorWithdrawalsData?.count ?? 0;
  const pendingServiceFeeLettersCount = pendingServiceFeeLettersData?.count ?? 0;
  const activeApplicationProductKeys = React.useMemo(
    () => activeProductBaseKeySet(applicationNavGroups),
    [applicationNavGroups]
  );
  const firstActionApplication = applicationsForSidebar.find((application) => {
    if (!APPLICATION_ACTION_REQUIRED_STATUS_SET.has(application.status)) return false;
    const key = application.baseProductId ?? application.productId;
    return Boolean(key && activeApplicationProductKeys.has(key));
  });
  const firstApplicationQueue = applicationsForSidebar.find((application) => {
    const key = application.baseProductId ?? application.productId;
    return Boolean(key && activeApplicationProductKeys.has(key));
  });
  const firstProductQueueKey = React.useMemo(() => {
    const products = productsData?.products ?? [];
    const active = products.find((product) => (product.status ?? "ACTIVE") === "ACTIVE");
    const fallback = active ?? products[0];
    return fallback ? (fallback.base_id ?? fallback.id) : null;
  }, [productsData?.products]);
  const applicationActionQueueKey =
    firstActionApplication?.baseProductId ??
    firstActionApplication?.productId ??
    firstApplicationQueue?.baseProductId ??
    firstApplicationQueue?.productId ??
    firstProductQueueKey;
  const applicationActionHref = applicationActionQueueKey
    ? `/applications/${applicationActionQueueKey}`
    : "/applications";

  const hasAnyQuickAction =
    canOnboarding || canApplications || canNotes || canRepayments || canServiceFee || canDisbursements;

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
      {!hasAnyQuickAction ? (
        <p className="text-sm text-muted-foreground">No quick actions available for your role.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 auto-rows-fr [&>*]:h-full [&>*]:min-h-0">
          {canOnboarding && (
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
          )}
          {canApplications && (
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
              loading={loading || isApplicationsForSidebarLoading || isProductsLoading}
            />
          )}
          {canNotes && (
            <QuickActionCard
              title="Note Actions"
              description="Create notes from approved invoices, publish drafts, and close funded notes"
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
          )}
          {canRepayments && (
            <QuickActionCard
              title="Pending Repayments"
              description="Review repayment receipts awaiting reconciliation before settlement"
              count={pendingRepaymentsCount}
              countLabel="open"
              href="/finance/repayments"
              icon={ArrowDownTrayIcon}
              variant={
                pendingRepaymentsCount > 5
                  ? "urgent"
                  : pendingRepaymentsCount > 0
                    ? "warning"
                    : "default"
              }
              loading={loading || isPendingRepaymentsLoading}
            />
          )}
          {canServiceFee && (
            <QuickActionCard
              title="Service Fee Instructions"
              description="Posted settlements with a service fee still in the trustee instruction workflow"
              count={pendingServiceFeeLettersCount}
              countLabel="pending"
              href="/finance/service-fee-trustee-letters"
              icon={ArrowsRightLeftIcon}
              variant={
                pendingServiceFeeLettersCount > 5
                  ? "urgent"
                  : pendingServiceFeeLettersCount > 0
                    ? "warning"
                    : "default"
              }
              loading={loading || isPendingServiceFeeLettersLoading}
            />
          )}
          {canViewInvestorWithdrawals && (
            <QuickActionCard
              title="Issuer Payouts"
              description="Issuer residual refunds in flight — generate letters and mark disbursed"
              count={pendingIssuerPayoutsCount}
              countLabel="open"
              href="/finance/issuer-payouts"
              icon={ArrowUpTrayIcon}
              variant={
                pendingIssuerPayoutsCount > 5
                  ? "urgent"
                  : pendingIssuerPayoutsCount > 0
                    ? "warning"
                    : "default"
              }
              loading={loading || isPendingIssuerPayoutsLoading}
            />
          )}
          {canDisbursements && (
            <QuickActionCard
              title="Investor Withdrawals"
              description="Review and process investor withdrawal requests."
              count={pendingInvestorWithdrawalsCount}
              countLabel="pending"
              href="/finance/investor-withdrawals"
              icon={ArrowUpTrayIcon}
              variant={
                pendingInvestorWithdrawalsCount > 5
                  ? "urgent"
                  : pendingInvestorWithdrawalsCount > 0
                    ? "warning"
                    : "default"
              }
              loading={loading || isPendingInvestorWithdrawalsLoading}
            />
          )}
        </div>
      )}
    </section>
  );
}
