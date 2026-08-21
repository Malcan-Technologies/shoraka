"use client";

import { StatusBadge } from "@cashsouk/ui";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ClockIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { AdminActivityCsvExportButton } from "@/components/admin-activity-csv-export-button";
import { mergeActivityCsvMetadata } from "@/components/admin-activity-csv";
import { resolveAdminTimelineActorLabel } from "@/components/admin-timeline-originator";
import {
  AdminVerticalTimeline,
  AdminVerticalTimelineItem,
} from "@/components/admin-vertical-timeline";
import { formatCurrency } from "@cashsouk/config";
import { ApplicationReviewRemarkDialog } from "@/components/application-review-remark-dialog";
import {
  formatDate,
  PURPOSE_LABEL,
  STATUS_LABEL,
  statusToken,
} from "@/lib/gateway-payment-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getGatewayAccountBadgeClassName,
  getGatewayAccountLabel,
} from "@/lib/gateway-account";
import {
  useApproveGatewayNameCheck,
  useGatewayPayment,
  useGatewayPaymentReceiptPdf,
  useInitiateGatewayPaymentRefund,
  useRejectGatewayNameCheck,
  useRetryGatewayPaymentReceipt,
  useRetryGatewayPaymentRefund,
} from "@/hooks/use-gateway-payments";
import { cn } from "@/lib/utils";
import {
  getGatewayPaymentDetailVisibility,
  readRefundRequestedAt,
} from "./gateway-payment-detail-model";
import {
  GATEWAY_PAYMENT_COPY,
  formatAmountMismatchDescription,
  formatGatewayEventDescription,
  formatGatewayEventTitle,
  formatGatewayPaymentFailureReason,
  hasUncertainAmountMismatchRefund,
} from "./gateway-payment-copy";

const RECEIPT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Being prepared",
  GENERATED: "Ready",
  FAILED: "Could not be prepared",
  REFUNDED: "Refunded",
};

function receiptStatusToken(status: string) {
  if (status === "GENERATED") return "success" as const;
  if (status === "FAILED") return "rejected" as const;
  if (status === "REFUNDED") return "neutral" as const;
  if (status === "PENDING") return "action" as const;
  return "neutral" as const;
}

function formatPendingDuration(fromIso: string) {
  const start = new Date(fromIso).getTime();
  if (!Number.isFinite(start)) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 48) return rem === 0 ? `${hours} hr` : `${hours} hr ${rem} min`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function senToDisplayMyr(sen: number) {
  return formatCurrency(sen / 100);
}

function formatStatusLabel(status: string | null | undefined) {
  if (!status) return null;
  return STATUS_LABEL[status] ?? status;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-11 w-11 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium text-foreground",
          mono && "break-all font-mono text-xs"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export default function GatewayPaymentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : null;
  const { can } = usePermissions();

  const canManage = can("gateway_payments.manage");
  const disabledReason = !canManage
    ? "You do not have permission to perform this action."
    : undefined;

  const {
    data: payment,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useGatewayPayment(id);

  const retryRefund = useRetryGatewayPaymentRefund();
  const initiateRefund = useInitiateGatewayPaymentRefund();
  const approveNameCheck = useApproveGatewayNameCheck();
  const rejectNameCheck = useRejectGatewayNameCheck();
  const receiptPdf = useGatewayPaymentReceiptPdf();
  const retryReceipt = useRetryGatewayPaymentReceipt();
  const [showRefundDialog, setShowRefundDialog] = React.useState(false);

  const isPending =
    retryRefund.isPending ||
    initiateRefund.isPending ||
    approveNameCheck.isPending ||
    rejectNameCheck.isPending ||
    receiptPdf.isPending ||
    retryReceipt.isPending;

  const visibility = payment
    ? getGatewayPaymentDetailVisibility(payment)
    : null;
  const amountMismatch = visibility?.amountMismatch ?? null;
  const currencyMismatch = visibility?.currencyMismatch ?? null;
  const walletReversalFailure = visibility?.walletReversalFailure ?? null;
  const refundRequestedAt = readRefundRequestedAt(
    payment
      ? {
          metadata: payment.metadata,
          events: payment.events,
        }
      : null
  );
  const pendingDuration = refundRequestedAt
    ? formatPendingDuration(refundRequestedAt)
    : null;

  const showReviewNameCheck = Boolean(visibility?.showReviewNameCheck);
  const showMismatchRefundPending = Boolean(visibility?.showMismatchRefundPending);
  const showMismatchRefunded = Boolean(visibility?.showMismatchRefunded);
  const showCurrencyMismatchCard = Boolean(visibility?.showCurrencyMismatchCard);
  const showWalletReversalCard = Boolean(visibility?.showWalletReversalCard);
  const showRetryRefund = Boolean(visibility?.showRetryRefund);
  const showInitiateRefund = Boolean(visibility?.showInitiateRefund);
  const showNameCheckCard = Boolean(visibility?.showNameCheckCard);
  const showHeldRefundCard = Boolean(visibility?.showHeldRefundCard);
  const timelineEvents = payment?.events ?? [];
  const activityCsvRows = timelineEvents.map((event) => ({
    createdAt: event.createdAt,
    event: formatGatewayEventTitle(event.type, event.reason),
    eventType: event.type,
    actor: event.actorName ?? "",
    actorUserId: event.actorUserId ?? "",
    portal: "",
    remark: event.reason ?? "",
    metadata: mergeActivityCsvMetadata(null, {
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
    }),
  }));

  const handleRetryRefund = async () => {
    if (!id) return;
    try {
      await retryRefund.mutateAsync(id);
      toast.success(
        showWalletReversalCard
          ? GATEWAY_PAYMENT_COPY.toasts.walletUpdateRetried
          : GATEWAY_PAYMENT_COPY.toasts.refundRetried
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund retry failed");
    }
  };

  const handleInitiateRefund = async (reason: string) => {
    if (!id) return;
    try {
      await initiateRefund.mutateAsync({ id, reason });
      toast.success(GATEWAY_PAYMENT_COPY.toasts.refundStarted);
      setShowRefundDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund initiation failed");
    }
  };

  const handleApproveNameCheck = async () => {
    if (!id) return;
    try {
      await approveNameCheck.mutateAsync(id);
      toast.success(GATEWAY_PAYMENT_COPY.toasts.nameCheckApproved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Name check approval failed");
    }
  };

  const handleRejectNameCheck = async () => {
    if (!id) return;
    try {
      await rejectNameCheck.mutateAsync(id);
      toast.success(GATEWAY_PAYMENT_COPY.toasts.nameCheckRejected);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Name check rejection failed");
    }
  };

  const handleOpenReceiptPdf = async (mode: "view" | "download") => {
    const receiptId = payment?.receipt?.id;
    if (!receiptId) return;
    try {
      const result = await receiptPdf.mutateAsync({ receiptId, mode });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open receipt PDF");
    }
  };

  const handleRetryReceipt = async () => {
    const receiptId = payment?.receipt?.id;
    if (!receiptId || !id) return;
    try {
      await retryReceipt.mutateAsync({ receiptId, gatewayPaymentId: id });
      toast.success(GATEWAY_PAYMENT_COPY.toasts.receiptRetried);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Receipt retry failed");
    }
  };

  return (
    <RequirePermission permission="gateway_payments.view">
      <>
        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/finance/gateway-payments")}
                className="gap-1.5"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Gateway Payments
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void refetch();
                }}
                disabled={isFetching || isLoading}
                className="h-8 w-8 p-0"
                title="Reload this payment from the server"
                aria-label="Refresh"
              >
                <ArrowPathIcon
                  className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            {isLoading ? <PageSkeleton /> : null}

            {error || (!isLoading && !payment) ? (
              <div className="py-8 text-center text-destructive">
                Failed to load gateway payment.
              </div>
            ) : null}

            {payment ? (
              <div className="space-y-6">
                {/* Page identity — same pattern as note detail */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <BanknotesIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Gateway Payment
                      </div>
                      <h2 className="truncate text-2xl font-bold">
                        {PURPOSE_LABEL[payment.purpose] ?? payment.purpose}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {payment.investorOrganizationName ?? "No organization"}
                        {" · "}
                        {getGatewayAccountLabel(payment.gatewayAccount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <StatusBadge
                      label={STATUS_LABEL[payment.status] ?? payment.status}
                      status={statusToken(payment.status)}
                    />
                    <Badge
                      variant="outline"
                      className={getGatewayAccountBadgeClassName(payment.gatewayAccount)}
                    >
                      {getGatewayAccountLabel(payment.gatewayAccount)}
                    </Badge>
                  </div>
                </div>

                {/* Metrics strip — same as note detail */}
                <Card className="rounded-2xl">
                  <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6">
                    <Metric label={GATEWAY_PAYMENT_COPY.metrics.amountPaid}>{formatCurrency(payment.amount)}</Metric>
                    <Metric label={GATEWAY_PAYMENT_COPY.metrics.currency}>{payment.currency}</Metric>
                    <Metric label={GATEWAY_PAYMENT_COPY.metrics.method}>{payment.method ?? "—"}</Metric>
                    <Metric label={GATEWAY_PAYMENT_COPY.metrics.bank}>{payment.bankCode ?? "—"}</Metric>
                    <Metric label={GATEWAY_PAYMENT_COPY.metrics.created}>
                      <span className="text-base">{formatDate(payment.createdAt)}</span>
                    </Metric>
                    <Metric label={GATEWAY_PAYMENT_COPY.metrics.updated}>
                      <span className="text-base">{formatDate(payment.updatedAt)}</span>
                    </Metric>
                  </CardContent>
                </Card>

                {showNameCheckCard ? (
                  <Card
                    className={cn(
                      "rounded-2xl",
                      "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{GATEWAY_PAYMENT_COPY.nameCheck.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {GATEWAY_PAYMENT_COPY.nameCheck.description}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.nameCheck.profileName}</p>
                          <p className="mt-1 text-sm font-medium">
                            {payment.expectedPayerName ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.nameCheck.bankName}</p>
                          <p className="mt-1 text-sm font-medium">
                            {payment.payerName ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void handleApproveNameCheck()}
                          disabled={!canManage || isPending}
                          title={disabledReason}
                        >
                          {GATEWAY_PAYMENT_COPY.nameCheck.approve}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => void handleRejectNameCheck()}
                          disabled={!canManage || isPending}
                          title={disabledReason}
                        >
                          {GATEWAY_PAYMENT_COPY.nameCheck.reject}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {showMismatchRefundPending && amountMismatch ? (
                  <Card
                    className={cn(
                      "rounded-2xl",
                      "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{GATEWAY_PAYMENT_COPY.amountMismatch.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatAmountMismatchDescription({
                          expectedSen: amountMismatch.expectedSen,
                          receivedSen: amountMismatch.actualSen,
                          refundSen: amountMismatch.actualSen,
                          state: "pending",
                          formatSen: senToDisplayMyr,
                        })}
                      </p>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.expectedAmount}</p>
                        <p className="mt-1 text-sm font-medium">
                          {senToDisplayMyr(amountMismatch.expectedSen)}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.amountReceived}</p>
                        <p className="mt-1 text-sm font-medium">
                          {senToDisplayMyr(amountMismatch.actualSen)}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.refundAmount}</p>
                        <p className="mt-1 text-sm font-medium">
                          {senToDisplayMyr(amountMismatch.actualSen)}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.refundReference}</p>
                        <p className="mt-1 break-all text-sm font-medium">
                          {payment.refundReference ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.refundRequested}</p>
                        <p className="mt-1 text-sm font-medium">
                          {refundRequestedAt ? formatDate(refundRequestedAt) : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.refundPendingFor}</p>
                        <p className="mt-1 text-sm font-medium">{pendingDuration ?? "—"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {showCurrencyMismatchCard && currencyMismatch ? (
                  <Card
                    className={cn(
                      "rounded-2xl",
                      "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{GATEWAY_PAYMENT_COPY.currencyMismatch.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {GATEWAY_PAYMENT_COPY.currencyMismatch.description}
                      </p>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.currencyMismatch.expectedCurrency}</p>
                        <p className="mt-1 text-sm font-medium">
                          {currencyMismatch.expectedCurrency ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.currencyMismatch.paymentCurrency}</p>
                        <p className="mt-1 text-sm font-medium">
                          {currencyMismatch.actualCurrency ?? "—"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {showMismatchRefunded && amountMismatch ? (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Refunded</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatAmountMismatchDescription({
                          expectedSen: amountMismatch.expectedSen,
                          receivedSen: amountMismatch.actualSen,
                          refundSen: amountMismatch.actualSen,
                          state: "completed",
                          formatSen: senToDisplayMyr,
                        })}
                      </p>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.expectedAmount}</p>
                        <p className="mt-1 text-sm font-medium">
                          {senToDisplayMyr(amountMismatch.expectedSen)}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.amountReceivedRefunded}</p>
                        <p className="mt-1 text-sm font-medium">
                          {senToDisplayMyr(amountMismatch.actualSen)}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.refundReference}</p>
                        <p className="mt-1 break-all text-sm font-medium">
                          {payment.refundReference ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.refundDate}</p>
                        <p className="mt-1 text-sm font-medium">
                          {payment.refundedAt ? formatDate(payment.refundedAt) : "—"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {showWalletReversalCard && walletReversalFailure ? (
                  <Card
                    className={cn(
                      "rounded-2xl",
                      walletReversalFailure.fundsProtected
                        ? "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]"
                        : "border-destructive/40 bg-destructive/5 shadow-[0_0_0_1px_hsl(var(--destructive)/0.1),0_0_28px_hsl(var(--destructive)/0.12)]"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Needs attention</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {walletReversalFailure.fundsProtected === false &&
                        walletReversalFailure.blockedAmount != null &&
                        walletReversalFailure.intendedReversalAmount != null &&
                        walletReversalFailure.blockedAmount + 1e-9 <
                          walletReversalFailure.intendedReversalAmount
                          ? GATEWAY_PAYMENT_COPY.walletNeedsAttention.descriptionPartial
                          : GATEWAY_PAYMENT_COPY.walletNeedsAttention.description}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.walletNeedsAttention.refundAmount}</p>
                          <p className="mt-1 text-sm font-medium">
                            {walletReversalFailure.intendedReversalAmount != null
                              ? formatCurrency(walletReversalFailure.intendedReversalAmount)
                              : formatCurrency(payment.amount)}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.walletNeedsAttention.amountUnavailable}</p>
                          <p className="mt-1 text-sm font-medium">
                            {walletReversalFailure.blockedAmount != null
                              ? formatCurrency(walletReversalFailure.blockedAmount)
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.walletNeedsAttention.originalDepositReference}</p>
                          <p className="mt-1 break-all text-sm font-medium">
                            {walletReversalFailure.originalWalletCreditKey ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.refundReference}</p>
                          <p className="mt-1 break-all text-sm font-medium">
                            {walletReversalFailure.refundId ?? payment.refundReference ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.walletNeedsAttention.lastUpdateAttempt}</p>
                          <p className="mt-1 text-sm font-medium">
                            {walletReversalFailure.lastAttemptAt
                              ? formatDate(walletReversalFailure.lastAttemptAt)
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.walletNeedsAttention.reason}</p>
                          <p className="mt-1 text-sm font-medium">
                            {formatGatewayPaymentFailureReason(
                              walletReversalFailure.error,
                              walletReversalFailure.failureCategory
                            )}
                          </p>
                        </div>
                      </div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          walletReversalFailure.fundsProtected
                            ? "text-foreground"
                            : "text-destructive"
                        )}
                      >
                        {walletReversalFailure.fundsProtected
                          ? GATEWAY_PAYMENT_COPY.walletNeedsAttention.fundsSecuredYes
                          : GATEWAY_PAYMENT_COPY.walletNeedsAttention.fundsSecuredNo}
                      </p>
                      <Button
                        variant="destructive"
                        onClick={() => void handleRetryRefund()}
                        disabled={!canManage || isPending}
                        title={disabledReason}
                      >
                        {GATEWAY_PAYMENT_COPY.walletNeedsAttention.retryButton}
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                {showHeldRefundCard ? (
                  <Card
                    className={cn(
                      "rounded-2xl",
                      "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {amountMismatch
                          ? GATEWAY_PAYMENT_COPY.heldRefund.titleMismatch
                          : GATEWAY_PAYMENT_COPY.heldRefund.titleDefault}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {amountMismatch
                          ? formatAmountMismatchDescription({
                              expectedSen: amountMismatch.expectedSen,
                              receivedSen: amountMismatch.actualSen,
                              refundSen: amountMismatch.actualSen,
                              state: hasUncertainAmountMismatchRefund(payment.metadata)
                                ? "uncertain"
                                : "failed",
                              formatSen: senToDisplayMyr,
                            })
                          : GATEWAY_PAYMENT_COPY.heldRefund.descriptionDefault}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {amountMismatch ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                            <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.expectedAmount}</p>
                            <p className="mt-1 text-sm font-medium">
                              {senToDisplayMyr(amountMismatch.expectedSen)}
                            </p>
                          </div>
                          <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                            <p className="text-xs text-muted-foreground">{GATEWAY_PAYMENT_COPY.amountMismatch.amountReceived}</p>
                            <p className="mt-1 text-sm font-medium">
                              {senToDisplayMyr(amountMismatch.actualSen)}
                            </p>
                          </div>
                        </div>
                      ) : null}
                      {payment.refundNotes ? (
                        <p className="text-sm text-muted-foreground">{payment.refundNotes}</p>
                      ) : null}
                      <Button
                        variant="destructive"
                        onClick={() => void handleRetryRefund()}
                        disabled={!canManage || isPending}
                        title={disabledReason}
                      >
                        {GATEWAY_PAYMENT_COPY.heldRefund.retryButton}
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                {showInitiateRefund ? (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {GATEWAY_PAYMENT_COPY.initiateRefund.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {GATEWAY_PAYMENT_COPY.initiateRefund.description}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRefundDialog(true)}
                        disabled={!canManage || isPending}
                        title={disabledReason}
                        className="h-9 rounded-xl"
                      >
                        {GATEWAY_PAYMENT_COPY.initiateRefund.button}
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                {/* Main + side — same grid as note detail */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                  <div className="min-w-0 space-y-6">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {GATEWAY_PAYMENT_COPY.paymentDetails.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {GATEWAY_PAYMENT_COPY.paymentDetails.description}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <dl className="space-y-2.5">
                          {!showReviewNameCheck ? (
                            <>
                              <DetailRow
                                label={GATEWAY_PAYMENT_COPY.paymentDetails.profileName}
                                value={payment.expectedPayerName ?? "—"}
                              />
                              <DetailRow
                                label={GATEWAY_PAYMENT_COPY.paymentDetails.bankName}
                                value={payment.payerName ?? "—"}
                              />
                            </>
                          ) : null}
                          <DetailRow
                            label={GATEWAY_PAYMENT_COPY.paymentDetails.orderReference}
                            value={payment.curlecOrderId}
                            mono
                          />
                          <DetailRow
                            label={GATEWAY_PAYMENT_COPY.paymentDetails.paymentReference}
                            value={payment.curlecPaymentId ?? "—"}
                            mono
                          />
                          <DetailRow
                            label={GATEWAY_PAYMENT_COPY.paymentDetails.settlement}
                            value={payment.settlementId ?? "—"}
                            mono
                          />
                          <DetailRow
                            label={GATEWAY_PAYMENT_COPY.paymentDetails.refundReference}
                            value={payment.refundReference ?? "—"}
                            mono
                          />
                          {payment.nameCheckResult ? (
                            <DetailRow label={GATEWAY_PAYMENT_COPY.paymentDetails.nameCheck} value={payment.nameCheckResult} />
                          ) : null}
                          {payment.nameCheckAt ? (
                            <DetailRow
                              label={GATEWAY_PAYMENT_COPY.paymentDetails.nameCheckAt}
                              value={formatDate(payment.nameCheckAt)}
                            />
                          ) : null}
                          {payment.refundedAt ? (
                            <DetailRow
                              label={GATEWAY_PAYMENT_COPY.paymentDetails.refundedAt}
                              value={formatDate(payment.refundedAt)}
                            />
                          ) : null}
                          {payment.refundNotes && !showRetryRefund ? (
                            <DetailRow label={GATEWAY_PAYMENT_COPY.paymentDetails.refundNotes} value={payment.refundNotes} />
                          ) : null}
                        </dl>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                            {GATEWAY_PAYMENT_COPY.receipt.title}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {GATEWAY_PAYMENT_COPY.receipt.description}
                          </p>
                        </div>
                        {payment.receipt ? (
                          <StatusBadge
                            label={RECEIPT_STATUS_LABEL[payment.receipt.status] ?? payment.receipt.status}
                            status={receiptStatusToken(payment.receipt.status)}
                          />
                        ) : (
                          <Badge variant="outline">{GATEWAY_PAYMENT_COPY.receipt.notCreated}</Badge>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {!payment.receipt ? (
                          <div className="rounded-xl border border-dashed bg-muted/20 p-4">
                            <p className="text-sm font-medium">
                              {GATEWAY_PAYMENT_COPY.receipt.noneYetTitle}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {GATEWAY_PAYMENT_COPY.receipt.noneYetDescription}
                            </p>
                          </div>
                        ) : (
                          <>
                            <dl className="space-y-2.5">
                              <DetailRow
                                label={GATEWAY_PAYMENT_COPY.receipt.receiptNumber}
                                value={payment.receipt.receiptNumber}
                                mono
                              />
                              <DetailRow
                                label={GATEWAY_PAYMENT_COPY.receipt.receiptName}
                                value={payment.receipt.payerName || "—"}
                              />
                              <DetailRow
                                label={GATEWAY_PAYMENT_COPY.receipt.receiptCompany}
                                value={payment.receipt.payerCompanyName || "—"}
                              />
                              <DetailRow
                                label={GATEWAY_PAYMENT_COPY.receipt.paymentDate}
                                value={formatDate(payment.receipt.paymentDate)}
                              />
                              {payment.receipt.relatedReferenceLabel &&
                              payment.receipt.relatedReference ? (
                                <DetailRow
                                  label={payment.receipt.relatedReferenceLabel}
                                  value={payment.receipt.relatedReference}
                                  mono
                                />
                              ) : null}
                            </dl>
                            <div className="flex flex-wrap gap-2 border-t pt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleOpenReceiptPdf("view")}
                                disabled={!payment.receipt.hasPdf || isPending}
                              >
                                {GATEWAY_PAYMENT_COPY.receipt.view}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleOpenReceiptPdf("download")}
                                disabled={!payment.receipt.hasPdf || isPending}
                              >
                                {GATEWAY_PAYMENT_COPY.receipt.download}
                              </Button>
                              {canManage &&
                              (payment.receipt.status === "PENDING" ||
                                payment.receipt.status === "FAILED") ? (
                                <Button
                                  size="sm"
                                  variant={
                                    payment.receipt.status === "FAILED" ? "default" : "outline"
                                  }
                                  onClick={() => void handleRetryReceipt()}
                                  disabled={isPending}
                                  title={disabledReason}
                                >
                                  {GATEWAY_PAYMENT_COPY.receipt.retry}
                                </Button>
                              ) : null}
                            </div>
                            {!payment.receipt.hasPdf ? (
                              <p className="text-xs text-muted-foreground">
                                {payment.receipt.status === "FAILED"
                                  ? GATEWAY_PAYMENT_COPY.receipt.failedDescription
                                  : GATEWAY_PAYMENT_COPY.receipt.pendingDescription}
                              </p>
                            ) : null}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="min-w-0 space-y-6">
                    <Card className="flex flex-col overflow-hidden rounded-2xl">
                      <AdminDetailCardHeader
                        icon={ClockIcon}
                        title={GATEWAY_PAYMENT_COPY.activity.title}
                        description={
                          timelineEvents.length === 0
                            ? GATEWAY_PAYMENT_COPY.activity.description
                            : `${timelineEvents.length} ${timelineEvents.length === 1 ? "event" : "events"}`
                        }
                        actions={
                          <AdminActivityCsvExportButton
                            fileName={`gateway-payment-${id ?? "activity"}-activity.csv`}
                            rows={activityCsvRows}
                          />
                        }
                      />
                      <CardContent className="min-h-0 overflow-hidden !px-0">
                        {timelineEvents.length === 0 ? (
                          <div className="px-6 py-8 text-center text-ui text-muted-foreground">
                            {GATEWAY_PAYMENT_COPY.activity.empty}
                          </div>
                        ) : (
                          <div className="px-6 pb-6">
                            <AdminVerticalTimeline>
                              {timelineEvents.map((event) => {
                                const fromLabel = formatStatusLabel(event.fromStatus);
                                const toLabel = formatStatusLabel(event.toStatus);
                                const description = formatGatewayEventDescription(
                                  event.type,
                                  event.reason
                                );
                                return (
                                  <AdminVerticalTimelineItem
                                    key={event.id}
                                    title={formatGatewayEventTitle(event.type, event.reason)}
                                    description={description}
                                    createdAt={event.createdAt}
                                    actorLabel={resolveAdminTimelineActorLabel({
                                      actorName: event.actorName,
                                      actorUserId: event.actorUserId,
                                      portal: "ADMIN",
                                    })}
                                    portal={event.actorUserId ? "ADMIN" : null}
                                    compactDetails={
                                      fromLabel && toLabel
                                        ? [{ label: "Status", value: `${fromLabel} → ${toLabel}` }]
                                        : undefined
                                    }
                                  />
                                );
                              })}
                            </AdminVerticalTimeline>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <ApplicationReviewRemarkDialog
          open={showRefundDialog}
          onOpenChange={setShowRefundDialog}
          title={GATEWAY_PAYMENT_COPY.initiateRefund.dialogTitle}
          description={GATEWAY_PAYMENT_COPY.initiateRefund.dialogDescription}
          submitLabel={GATEWAY_PAYMENT_COPY.initiateRefund.dialogSubmit}
          variant="destructive"
          onConfirm={handleInitiateRefund}
          isPending={isPending}
        />
      </>
    </RequirePermission>
  );
}
