"use client";

import * as React from "react";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import {
  activeProductPendingActionTotal,
  buildApplicationSidebarGroups,
  firstActiveActionQueuePath,
} from "@/applications/application-nav-groups";
import {
  dashboardQueueDescription,
  queuesNeedingAttention,
  urgencyVariant,
  type QuickActionQueue,
} from "@/components/dashboard/quick-action-queues";
import { useApplicationNavCounts } from "@/hooks/use-application-nav-counts";
import { usePendingApprovalCount } from "@/hooks/use-pending-approval-count";
import { useProducts } from "@/hooks/use-products";
import {
  useNoteActionRequiredCount,
  usePendingInvestorWithdrawals,
  usePendingIssuerPayouts,
  usePendingRepayments,
  usePendingSettlementTrusteeLetters,
} from "@/notes/hooks/use-notes";
import { usePermissions } from "@/hooks/use-permissions";
import { useGatewayPaymentsExceptionCount } from "@/hooks/use-gateway-payments";
import { useGatewayReconPendingCount } from "@/hooks/use-gateway-recon";

export function useQuickActionQueues({ loading = false }: { loading?: boolean } = {}) {
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
  const { data: pendingSettlementTrusteeLettersData, isLoading: isPendingSettlementTrusteeLettersLoading } =
    usePendingSettlementTrusteeLetters({ enabled: canServiceFee });
  const { data: gatewayPaymentExceptionsData, isLoading: isGatewayPaymentExceptionsLoading } =
    useGatewayPaymentsExceptionCount({ enabled: canViewGatewayPayments });
  const { data: gatewayReconExceptionsData, isLoading: isGatewayReconExceptionsLoading } =
    useGatewayReconPendingCount({ enabled: canViewReconciliation });
  const { data: navCountsData, isLoading: isNavCountsLoading } = useApplicationNavCounts({
    enabled: canApplications,
  });
  const { data: productsData, isLoading: isProductsLoading } = useProducts({
    page: 1,
    pageSize: 100,
    includeDeleted: true,
    enabled: canApplications,
  });

  const pendingOnboardingCount = pendingCountData?.count ?? 0;
  const applicationNavGroups = React.useMemo(
    () =>
      buildApplicationSidebarGroups(productsData?.products ?? [], navCountsData?.products ?? []),
    [productsData?.products, navCountsData?.products]
  );
  const applicationActionCount = activeProductPendingActionTotal(applicationNavGroups);
  const noteActionCount = noteActionCountData?.count ?? 0;
  const pendingRepaymentsCount = pendingRepaymentsData?.count ?? 0;
  const pendingIssuerPayoutsCount = pendingIssuerPayoutsData?.count ?? 0;
  const pendingInvestorWithdrawalsCount = pendingInvestorWithdrawalsData?.count ?? 0;
  const pendingSettlementTrusteeLettersCount = pendingSettlementTrusteeLettersData?.count ?? 0;
  const gatewayPaymentExceptionsCount = gatewayPaymentExceptionsData?.count ?? 0;
  const gatewayReconExceptionsCount = gatewayReconExceptionsData?.count ?? 0;
  const firstProductQueuePath = React.useMemo(() => {
    const products = productsData?.products ?? [];
    const active = products.find((product) => (product.status ?? "ACTIVE") === "ACTIVE");
    const fallback = active ?? products[0];
    return fallback ? `/applications/${fallback.base_id ?? fallback.id}` : null;
  }, [productsData?.products]);
  const applicationActionHref =
    firstActiveActionQueuePath(applicationNavGroups) ?? firstProductQueuePath ?? "/applications";

  const queues = React.useMemo(() => {
    const list: QuickActionQueue[] = [];

    if (canOnboarding) {
      list.push({
        id: "onboarding",
        title: "Onboarding Approval",
        shortTitle: "Onboarding",
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
        shortTitle: "Applications",
        description: "Review applications, send offers, and process accepted facilities",
        count: applicationActionCount,
        countLabel: "actions",
        href: applicationActionHref,
        icon: DocumentCheckIcon,
        variant: urgencyVariant(applicationActionCount, 5, 0),
        isLoading: loading || isNavCountsLoading || isProductsLoading,
      });
    }
    if (canNotes) {
      list.push({
        id: "notes",
        title: "Note Actions",
        shortTitle: "Notes",
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
        shortTitle: "Repayments",
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
        shortTitle: "Trustee letters",
        description: "Posted settlements still in the settlement trustee instruction workflow",
        count: pendingSettlementTrusteeLettersCount,
        countLabel: "pending",
        href: "/finance/service-fee-trustee-letters",
        icon: ArrowsRightLeftIcon,
        variant: urgencyVariant(pendingSettlementTrusteeLettersCount, 5, 0),
        isLoading: loading || isPendingSettlementTrusteeLettersLoading,
      });
    }
    if (canDisbursements) {
      list.push({
        id: "issuer-payouts",
        title: "Issuer Payouts",
        shortTitle: "Issuer payouts",
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
        shortTitle: "Withdrawals",
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
        shortTitle: "Payments",
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
        shortTitle: "Reconciliation",
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
    isNavCountsLoading,
    isGatewayPaymentExceptionsLoading,
    isGatewayReconExceptionsLoading,
    isNoteActionCountLoading,
    isPendingCountLoading,
    isPendingInvestorWithdrawalsLoading,
    isPendingIssuerPayoutsLoading,
    isPendingRepaymentsLoading,
    isPendingSettlementTrusteeLettersLoading,
    isProductsLoading,
    loading,
    noteActionCount,
    pendingInvestorWithdrawalsCount,
    pendingIssuerPayoutsCount,
    pendingOnboardingCount,
    pendingRepaymentsCount,
    pendingSettlementTrusteeLettersCount,
  ]);

  const ready = queues.length === 0 || queues.every((queue) => !queue.isLoading);
  const needsAttention = React.useMemo(() => queuesNeedingAttention(queues), [queues]);
  const totalOpenItems = needsAttention.reduce((sum, queue) => sum + queue.count, 0);
  const description = dashboardQueueDescription({
    ready,
    queueCount: queues.length,
    attentionCount: needsAttention.length,
    totalOpenItems,
  });

  return {
    queues,
    needsAttention,
    ready,
    totalOpenItems,
    description,
  };
}
