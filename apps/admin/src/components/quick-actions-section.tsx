"use client";

import * as React from "react";
import { QuickActionCard, type QuickActionCardProps } from "./quick-action-card";
import { QuickActionsSummaryBanner } from "./quick-actions-summary-banner";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  ChevronDownIcon,
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
import { useGatewayPaymentsExceptionCount } from "@/hooks/use-gateway-payments";
import { useGatewayReconPendingCount } from "@/hooks/use-gateway-recon";
import { cn } from "@/lib/utils";

interface QuickActionsSectionProps {
  loading?: boolean;
}

type QueueAction = Omit<QuickActionCardProps, "caughtUp"> & {
  id: string;
  isLoading: boolean;
};

function urgencyVariant(
  count: number,
  urgentAt: number,
  warnAt: number
): QuickActionCardProps["variant"] {
  if (count > urgentAt) return "urgent";
  if (count > warnAt) return "warning";
  return "default";
}

const VARIANT_RANK: Record<NonNullable<QuickActionCardProps["variant"]>, number> = {
  urgent: 0,
  warning: 1,
  default: 2,
};

function pickPriorityQueue(queues: QueueAction[]): QueueAction | null {
  if (queues.length === 0) return null;
  return [...queues].sort((a, b) => {
    const va = VARIANT_RANK[a.variant ?? "default"];
    const vb = VARIANT_RANK[b.variant ?? "default"];
    if (va !== vb) return va - vb;
    const ca = a.count ?? 0;
    const cb = b.count ?? 0;
    if (ca !== cb) return cb - ca;
    return 0;
  })[0];
}

function bannerDescription(queues: QueueAction[]): string {
  if (queues.length <= 3) {
    return queues.map((q) => q.title).join(" · ");
  }
  return `${queues.length} queues need attention`;
}

export function QuickActionsSection({ loading = false }: QuickActionsSectionProps) {
  const { can } = usePermissions();
  const canOnboarding = can("onboarding.view");
  const canApplications = can("applications.view");
  const canNotes = can("notes.view");
  const canRepayments = can("repayments.view");
  const canServiceFee = can("service_fee.view");
  const canDisbursements = can("disbursements.view");
  const canViewInvestorWithdrawals = can("investor_withdrawals.view");
  const canViewGatewayPayments = can("gateway_payments.view");
  const canViewReconciliation = can("gateway_reconciliation.view");

  const { data: pendingCountData, isLoading: isPendingCountLoading } = usePendingApprovalCount({
    enabled: canOnboarding,
  });
  const { data: noteActionCountData, isLoading: isNoteActionCountLoading } =
    useNoteActionRequiredCount({
      enabled: canNotes,
    });
  const { data: pendingRepaymentsData, isLoading: isPendingRepaymentsLoading } =
    usePendingRepayments({
      enabled: canRepayments,
    });
  const { data: pendingIssuerPayoutsData, isLoading: isPendingIssuerPayoutsLoading } =
    usePendingIssuerPayouts({ enabled: canDisbursements });
  const { data: pendingInvestorWithdrawalsData, isLoading: isPendingInvestorWithdrawalsLoading } =
    usePendingInvestorWithdrawals({ enabled: canViewInvestorWithdrawals });
  const { data: pendingServiceFeeLettersData, isLoading: isPendingServiceFeeLettersLoading } =
    usePendingServiceFeeTrusteeLetters({ enabled: canServiceFee });
  const { data: gatewayPaymentExceptionsData, isLoading: isGatewayPaymentExceptionsLoading } =
    useGatewayPaymentsExceptionCount({ enabled: canViewGatewayPayments });
  const { data: gatewayReconExceptionsData, isLoading: isGatewayReconExceptionsLoading } =
    useGatewayReconPendingCount({ enabled: canViewReconciliation });
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
  const gatewayPaymentExceptionsCount = gatewayPaymentExceptionsData?.count ?? 0;
  const gatewayReconExceptionsCount = gatewayReconExceptionsData?.count ?? 0;
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

  const actions = React.useMemo(() => {
    const list: QueueAction[] = [];

    if (canOnboarding) {
      list.push({
        id: "onboarding",
        title: "Onboarding Approval",
        description: "Review pending KYC/KYB applications",
        count: pendingOnboardingCount,
        countLabel: "pending",
        href: "/onboarding-approval",
        icon: ClipboardDocumentCheckIcon,
        variant: urgencyVariant(pendingOnboardingCount, 3, 0),
        isLoading: loading || isPendingCountLoading,
      });
    }
    if (canApplications) {
      list.push({
        id: "applications",
        title: "Application Actions",
        description: "Review applications, send offers, and process accepted contracts",
        count: applicationActionCount,
        countLabel: "actions",
        href: applicationActionHref,
        icon: DocumentCheckIcon,
        variant: urgencyVariant(applicationActionCount, 5, 0),
        isLoading: loading || isApplicationsForSidebarLoading || isProductsLoading,
      });
    }
    if (canNotes) {
      list.push({
        id: "notes",
        title: "Note Actions",
        description: "Create notes from approved invoices, publish drafts, and close funded notes",
        count: noteActionCount,
        countLabel: "actions",
        href: "/notes",
        icon: DocumentTextIcon,
        variant: urgencyVariant(noteActionCount, 5, 0),
        isLoading: loading || isNoteActionCountLoading,
      });
    }
    if (canRepayments) {
      list.push({
        id: "repayments",
        title: "Pending Repayments",
        description: "Review repayment receipts awaiting reconciliation before settlement",
        count: pendingRepaymentsCount,
        countLabel: "open",
        href: "/finance/repayments",
        icon: ArrowDownTrayIcon,
        variant: urgencyVariant(pendingRepaymentsCount, 5, 0),
        isLoading: loading || isPendingRepaymentsLoading,
      });
    }
    if (canServiceFee) {
      list.push({
        id: "service-fee",
        title: "Settlement Trustee Letters",
        description: "Posted settlements still in the settlement trustee instruction workflow",
        count: pendingServiceFeeLettersCount,
        countLabel: "pending",
        href: "/finance/service-fee-trustee-letters",
        icon: ArrowsRightLeftIcon,
        variant: urgencyVariant(pendingServiceFeeLettersCount, 5, 0),
        isLoading: loading || isPendingServiceFeeLettersLoading,
      });
    }
    if (canDisbursements) {
      list.push({
        id: "issuer-payouts",
        title: "Issuer Payouts",
        description: "Issuer residual refunds in flight — generate letters and mark disbursed",
        count: pendingIssuerPayoutsCount,
        countLabel: "open",
        href: "/finance/issuer-payouts",
        icon: ArrowUpTrayIcon,
        variant: urgencyVariant(pendingIssuerPayoutsCount, 5, 0),
        isLoading: loading || isPendingIssuerPayoutsLoading,
      });
    }
    if (canViewInvestorWithdrawals) {
      list.push({
        id: "investor-withdrawals",
        title: "Investor Withdrawals",
        description: "Review and process investor withdrawal requests.",
        count: pendingInvestorWithdrawalsCount,
        countLabel: "pending",
        href: "/finance/investor-withdrawals",
        icon: ArrowUpTrayIcon,
        variant: urgencyVariant(pendingInvestorWithdrawalsCount, 5, 0),
        isLoading: loading || isPendingInvestorWithdrawalsLoading,
      });
    }
    if (canViewGatewayPayments) {
      list.push({
        id: "gateway-payments",
        title: "Gateway Payments",
        description: "Review payment status, refunds, and name checks",
        count: gatewayPaymentExceptionsCount,
        countLabel: "open",
        href: "/finance/gateway-payments",
        icon: BanknotesIcon,
        variant: urgencyVariant(gatewayPaymentExceptionsCount, 5, 0),
        isLoading: loading || isGatewayPaymentExceptionsLoading,
      });
    }
    if (canViewReconciliation) {
      list.push({
        id: "reconciliation",
        title: "Reconciliation",
        description: "Review settlement runs and exceptions",
        count: gatewayReconExceptionsCount,
        countLabel: "open",
        href: "/finance/reconciliation",
        icon: ArrowsRightLeftIcon,
        variant: urgencyVariant(gatewayReconExceptionsCount, 5, 0),
        isLoading: loading || isGatewayReconExceptionsLoading,
      });
    }

    return list;
  }, [
    applicationActionCount,
    applicationActionHref,
    canApplications,
    canDisbursements,
    canNotes,
    canOnboarding,
    canRepayments,
    canServiceFee,
    canViewGatewayPayments,
    canViewInvestorWithdrawals,
    canViewReconciliation,
    gatewayPaymentExceptionsCount,
    gatewayReconExceptionsCount,
    isApplicationsForSidebarLoading,
    isGatewayPaymentExceptionsLoading,
    isGatewayReconExceptionsLoading,
    isNoteActionCountLoading,
    isPendingCountLoading,
    isPendingInvestorWithdrawalsLoading,
    isPendingIssuerPayoutsLoading,
    isPendingRepaymentsLoading,
    isPendingServiceFeeLettersLoading,
    isProductsLoading,
    loading,
    noteActionCount,
    pendingInvestorWithdrawalsCount,
    pendingIssuerPayoutsCount,
    pendingOnboardingCount,
    pendingRepaymentsCount,
    pendingServiceFeeLettersCount,
  ]);

  const loadingActions = actions.filter((action) => action.isLoading);
  const needsAttention = actions.filter((action) => !action.isLoading && (action.count ?? 0) > 0);
  const caughtUp = actions.filter((action) => !action.isLoading && (action.count ?? 0) === 0);
  const [caughtUpOpen, setCaughtUpOpen] = React.useState(false);
  const totalOpenItems = needsAttention.reduce((sum, action) => sum + (action.count ?? 0), 0);
  const priorityQueue = pickPriorityQueue(needsAttention);
  const queuesReady = loadingActions.length === 0 && actions.length > 0;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-primary md:text-2xl">
          Quick Actions
        </h2>
        <p className="text-sm text-muted-foreground">Tasks that need your attention</p>
      </div>

      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No quick actions available for your role.</p>
      ) : (
        <div className="space-y-3">
          {queuesReady && needsAttention.length > 0 && priorityQueue ? (
            <QuickActionsSummaryBanner
              layout="stack"
              title={`${totalOpenItems} action${totalOpenItems === 1 ? "" : "s"} required`}
              description={bannerDescription(needsAttention)}
              href={priorityQueue.href}
              ctaLabel={priorityQueue.title}
            />
          ) : null}

          {queuesReady && needsAttention.length === 0 && caughtUp.length > 0 ? (
            <QuickActionsSummaryBanner layout="stack" title="All queues are clear" tone="neutral" />
          ) : null}

          {needsAttention.length > 0 || loadingActions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {needsAttention.map((action) => (
                <QuickActionCard
                  key={action.id}
                  title={action.title}
                  description={action.description}
                  count={action.count}
                  countLabel={action.countLabel}
                  href={action.href}
                  icon={action.icon}
                  variant={action.variant}
                />
              ))}
              {loadingActions.map((action) => (
                <QuickActionCard
                  key={action.id}
                  title={action.title}
                  href={action.href}
                  icon={action.icon}
                  loading
                />
              ))}
            </div>
          ) : null}

          {caughtUp.length > 0 ? (
            <div className="rounded-xl border border-border/80">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[15px] font-medium leading-6 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                onClick={() => setCaughtUpOpen((open) => !open)}
                aria-expanded={caughtUpOpen}
              >
                <span>All caught up ({caughtUp.length})</span>
                <ChevronDownIcon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    caughtUpOpen && "rotate-180"
                  )}
                />
              </button>
              {caughtUpOpen ? (
                <div className="flex flex-col gap-2 border-t border-border/80 p-2">
                  {caughtUp.map((action) => (
                    <QuickActionCard
                      key={action.id}
                      title={action.title}
                      description={action.description}
                      count={0}
                      countLabel={action.countLabel}
                      href={action.href}
                      icon={action.icon}
                      variant="default"
                      caughtUp
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
