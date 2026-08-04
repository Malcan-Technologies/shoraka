"use client";

import { useHeader } from "@cashsouk/ui";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BanknotesIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { ApplicationReviewRemarkDialog } from "@/components/application-review-remark-dialog";
import {
  formatDate,
  PURPOSE_LABEL,
  STATUS_LABEL,
  statusVariant,
} from "@/components/gateway-payments-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getGatewayAccountBadgeClassName,
  getGatewayAccountDescription,
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

const RECEIPT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Preparing PDF",
  GENERATED: "Ready",
  FAILED: "PDF failed",
  REFUNDED: "Refunded",
};

function receiptStatusVariant(status: string) {
  if (status === "GENERATED") return "success" as const;
  if (status === "FAILED") return "destructive" as const;
  if (status === "REFUNDED") return "secondary" as const;
  if (status === "PENDING") return "warning" as const;
  return "outline" as const;
}

function formatEventType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  const { setTitle } = useHeader();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : null;
  const { can } = usePermissions();
  const canManage = can("gateway_payments.manage");
  const disabledReason = !canManage
    ? "You do not have permission to perform this action."
    : undefined;

  const { data: payment, isLoading, error, refetch, isFetching } = useGatewayPayment(id);
  const retryRefund = useRetryGatewayPaymentRefund();
  const initiateRefund = useInitiateGatewayPaymentRefund();
  const approveNameCheck = useApproveGatewayNameCheck();
  const rejectNameCheck = useRejectGatewayNameCheck();
  const receiptPdf = useGatewayPaymentReceiptPdf();
  const retryReceipt = useRetryGatewayPaymentReceipt();
  const [showRefundDialog, setShowRefundDialog] = React.useState(false);

  React.useEffect(() => {
    setTitle(
      payment
        ? `${PURPOSE_LABEL[payment.purpose] ?? payment.purpose} · ${formatCurrency(payment.amount)}`
        : "Gateway Payment"
    );
    return () => setTitle("");
  }, [setTitle, payment]);

  const isPending =
    retryRefund.isPending ||
    initiateRefund.isPending ||
    approveNameCheck.isPending ||
    rejectNameCheck.isPending ||
    receiptPdf.isPending ||
    retryReceipt.isPending;

  const showReviewNameCheck = payment?.status === "NAME_CHECK_PENDING";
  const showRetryRefund = payment?.status === "HELD";
  const showInitiateRefund =
    payment?.status === "COMPLETED" && payment.purpose === "INVESTOR_DEPOSIT";
  const hasOpsAction = Boolean(
    showReviewNameCheck || showRetryRefund || showInitiateRefund
  );

  const handleRetryRefund = async () => {
    if (!id) return;
    try {
      await retryRefund.mutateAsync(id);
      toast.success("Refund retry submitted to Curlec");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund retry failed");
    }
  };

  const handleInitiateRefund = async (reason: string) => {
    if (!id) return;
    try {
      await initiateRefund.mutateAsync({ id, reason });
      toast.success("Refund initiated via Curlec");
      setShowRefundDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund initiation failed");
    }
  };

  const handleApproveNameCheck = async () => {
    if (!id) return;
    try {
      await approveNameCheck.mutateAsync(id);
      toast.success("Name check approved — deposit credited");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Name check approval failed");
    }
  };

  const handleRejectNameCheck = async () => {
    if (!id) return;
    try {
      await rejectNameCheck.mutateAsync(id);
      toast.success("Name check rejected — refund initiated");
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
      toast.success("Receipt generation retried");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Receipt retry failed");
    }
  };

  return (
    <RequirePermission permission="gateway_payments.view">
      <>
        <div className="flex items-center gap-2 px-4 pt-4 md:px-6">
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
            onClick={() => void refetch()}
            disabled={isFetching || isLoading}
            className="h-8 w-8 p-0"
            title="Refresh"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
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
                    <Badge variant={statusVariant(payment.status)}>
                      {STATUS_LABEL[payment.status] ?? payment.status}
                    </Badge>
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
                    <Metric label="Amount paid">{formatCurrency(payment.amount)}</Metric>
                    <Metric label="Currency">{payment.currency}</Metric>
                    <Metric label="Method">{payment.method ?? "—"}</Metric>
                    <Metric label="Bank">{payment.bankCode ?? "—"}</Metric>
                    <Metric label="Created">
                      <span className="text-base">{formatDate(payment.createdAt)}</span>
                    </Metric>
                    <Metric label="Updated">
                      <span className="text-base">{formatDate(payment.updatedAt)}</span>
                    </Metric>
                  </CardContent>
                </Card>

                {/* Ops / lifecycle card — actions live here, like note lifecycle */}
                <Card
                  className={cn(
                    "rounded-2xl",
                    hasOpsAction &&
                      "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]"
                  )}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {showReviewNameCheck
                        ? "Next action — name check"
                        : showRetryRefund
                          ? "Next action — retry refund"
                          : showInitiateRefund
                            ? "Available action — refund"
                            : "Status"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {showReviewNameCheck
                        ? "Compare expected vs FPX payer, then approve or reject."
                        : showRetryRefund
                          ? "Auto-refund did not finish. Retry the Curlec refund."
                          : showInitiateRefund
                            ? "Deposit is completed. Use only for post-credit corrections."
                            : getGatewayAccountDescription(payment.gatewayAccount)}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {showReviewNameCheck ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                            <p className="text-xs text-muted-foreground">Expected payer</p>
                            <p className="mt-1 text-sm font-medium">
                              {payment.expectedPayerName ?? "—"}
                            </p>
                          </div>
                          <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                            <p className="text-xs text-muted-foreground">FPX payer name</p>
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
                            Approve name check
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => void handleRejectNameCheck()}
                            disabled={!canManage || isPending}
                            title={disabledReason}
                          >
                            Reject name check
                          </Button>
                        </div>
                      </>
                    ) : null}

                    {showRetryRefund ? (
                      <div className="flex flex-wrap items-center gap-3">
                        {payment.refundNotes ? (
                          <p className="text-sm text-muted-foreground">{payment.refundNotes}</p>
                        ) : null}
                        <Button
                          variant="destructive"
                          onClick={() => void handleRetryRefund()}
                          disabled={!canManage || isPending}
                          title={disabledReason}
                        >
                          Retry auto-refund
                        </Button>
                      </div>
                    ) : null}

                    {showInitiateRefund ? (
                      <Button
                        variant="destructive"
                        onClick={() => setShowRefundDialog(true)}
                        disabled={!canManage || isPending}
                        title={disabledReason}
                      >
                        Initiate refund
                      </Button>
                    ) : null}

                    {!hasOpsAction ? (
                      <p className="text-sm text-muted-foreground">
                        No admin action required for this payment right now.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Main + side — same grid as note detail */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                  <div className="min-w-0 space-y-6">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Payment details</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Gateway identifiers and settlement references.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <dl className="space-y-2.5">
                          {!showReviewNameCheck ? (
                            <>
                              <DetailRow
                                label="Expected payer"
                                value={payment.expectedPayerName ?? "—"}
                              />
                              <DetailRow
                                label="FPX payer name"
                                value={payment.payerName ?? "—"}
                              />
                            </>
                          ) : null}
                          <DetailRow
                            label="Curlec order"
                            value={payment.curlecOrderId}
                            mono
                          />
                          <DetailRow
                            label="Curlec payment"
                            value={payment.curlecPaymentId ?? "—"}
                            mono
                          />
                          <DetailRow
                            label="Settlement"
                            value={payment.settlementId ?? "—"}
                            mono
                          />
                          <DetailRow
                            label="Refund reference"
                            value={payment.refundReference ?? "—"}
                            mono
                          />
                          {payment.nameCheckResult ? (
                            <DetailRow label="Name check" value={payment.nameCheckResult} />
                          ) : null}
                          {payment.nameCheckAt ? (
                            <DetailRow
                              label="Name check at"
                              value={formatDate(payment.nameCheckAt)}
                            />
                          ) : null}
                          {payment.refundedAt ? (
                            <DetailRow
                              label="Refunded at"
                              value={formatDate(payment.refundedAt)}
                            />
                          ) : null}
                          {payment.refundNotes && !showRetryRefund ? (
                            <DetailRow label="Refund notes" value={payment.refundNotes} />
                          ) : null}
                        </dl>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                            Receipt
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Official Cashsouk payment receipt for finance records.
                          </p>
                        </div>
                        {payment.receipt ? (
                          <Badge variant={receiptStatusVariant(payment.receipt.status)}>
                            {RECEIPT_STATUS_LABEL[payment.receipt.status] ??
                              payment.receipt.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not created</Badge>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {!payment.receipt ? (
                          <div className="rounded-xl border border-dashed bg-muted/20 p-4">
                            <p className="text-sm font-medium">No receipt yet</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              A receipt is created after this payment is successfully
                              completed.
                            </p>
                          </div>
                        ) : (
                          <>
                            <dl className="space-y-2.5">
                              <DetailRow
                                label="Receipt number"
                                value={payment.receipt.receiptNumber}
                                mono
                              />
                              <DetailRow
                                label="Payer / company"
                                value={
                                  payment.receipt.payerCompanyName ||
                                  payment.receipt.payerName ||
                                  "—"
                                }
                              />
                              <DetailRow
                                label="Payment date"
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
                                View PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleOpenReceiptPdf("download")}
                                disabled={!payment.receipt.hasPdf || isPending}
                              >
                                Download PDF
                              </Button>
                              {canManage &&
                              (payment.receipt.status === "PENDING" ||
                                payment.receipt.status === "FAILED") ? (
                                <Button
                                  size="sm"
                                  onClick={() => void handleRetryReceipt()}
                                  disabled={isPending}
                                  title={disabledReason}
                                >
                                  Retry generation
                                </Button>
                              ) : null}
                            </div>
                            {!payment.receipt.hasPdf ? (
                              <p className="text-xs text-muted-foreground">
                                {payment.receipt.status === "FAILED"
                                  ? "PDF generation failed."
                                  : "PDF is still being prepared."}
                              </p>
                            ) : null}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="min-w-0 space-y-6">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Event trail</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Status changes and admin actions.
                        </p>
                      </CardHeader>
                      <CardContent>
                        {payment.events.length === 0 ? (
                          <div className="rounded-xl border border-dashed bg-muted/20 p-4">
                            <p className="text-sm text-muted-foreground">
                              No events recorded yet.
                            </p>
                          </div>
                        ) : (
                          <ol className="relative space-y-0 border-l border-border pl-4">
                            {payment.events.map((event) => {
                              const fromLabel = formatStatusLabel(event.fromStatus);
                              const toLabel = formatStatusLabel(event.toStatus);
                              return (
                                <li key={event.id} className="relative pb-5 last:pb-0">
                                  <span className="absolute -left-[1.2rem] top-1.5 h-2 w-2 rounded-full border-2 border-background bg-primary" />
                                  <div className="space-y-0.5">
                                    <p className="text-sm font-medium text-foreground">
                                      {formatEventType(event.type)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(event.createdAt)}
                                    </p>
                                    {fromLabel && toLabel ? (
                                      <p className="text-xs text-muted-foreground">
                                        {fromLabel} → {toLabel}
                                      </p>
                                    ) : null}
                                    {event.reason ? (
                                      <p className="text-xs text-foreground/90">
                                        {event.reason}
                                      </p>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
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
          title="Initiate refund"
          description="This will call the Curlec Refund API for a completed investor deposit. Use only for post-credit corrections."
          submitLabel="Initiate refund"
          variant="destructive"
          onConfirm={handleInitiateRefund}
          isPending={isPending}
        />
      </>
    </RequirePermission>
  );
}
