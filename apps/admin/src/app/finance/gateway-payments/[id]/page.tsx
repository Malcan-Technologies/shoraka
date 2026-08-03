"use client";

import { useHeader } from "@cashsouk/ui";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BanknotesIcon,
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

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={
          mono
            ? "break-all font-mono text-sm font-medium text-foreground"
            : "text-base font-medium text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}

export default function GatewayPaymentDetailPage() {
  const { setTitle } = useHeader();
  React.useEffect(() => {
    setTitle("Gateway Payment");
    return () => setTitle("");
  }, [setTitle]);

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
  const showActionsCard = Boolean(
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
        
        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/finance/gateway-payments">
                  <ArrowLeftIcon className="mr-1 h-4 w-4" />
                  Back to list
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="h-8 w-8 p-0"
                title="Refresh"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {isLoading ? (
              <DetailSkeleton />
            ) : error || !payment ? (
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="py-8 text-destructive">
                  Failed to load gateway payment.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <BanknotesIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Amount paid</p>
                          <p className="text-2xl font-semibold tracking-tight text-foreground">
                            {formatCurrency(payment.amount)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(payment.status)}>
                            {STATUS_LABEL[payment.status] ?? payment.status}
                          </Badge>
                          <Badge variant="outline">
                            {PURPOSE_LABEL[payment.purpose] ?? payment.purpose}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getGatewayAccountBadgeClassName(payment.gatewayAccount)}
                          >
                            {getGatewayAccountLabel(payment.gatewayAccount)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getGatewayAccountDescription(payment.gatewayAccount)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
                      <DetailField
                        label="Organization"
                        value={payment.investorOrganizationName ?? "—"}
                      />
                      <DetailField label="Currency" value={payment.currency} />
                      <DetailField label="Created" value={formatDate(payment.createdAt)} />
                      <DetailField label="Updated" value={formatDate(payment.updatedAt)} />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="space-y-6 lg:col-span-2">
                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Payment details</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-5 sm:grid-cols-2">
                        <DetailField
                          label="Expected payer"
                          value={payment.expectedPayerName ?? "—"}
                        />
                        <DetailField
                          label="FPX payer name"
                          value={payment.payerName ?? "—"}
                        />
                        <DetailField
                          label="Payment method"
                          value={payment.method ?? "—"}
                        />
                        <DetailField label="Bank" value={payment.bankCode ?? "—"} />
                        <DetailField
                          label="Curlec order ID"
                          value={payment.curlecOrderId}
                          mono
                        />
                        <DetailField
                          label="Curlec payment ID"
                          value={payment.curlecPaymentId ?? "—"}
                          mono
                        />
                        <DetailField
                          label="Settlement ID"
                          value={payment.settlementId ?? "—"}
                          mono
                        />
                        <DetailField
                          label="Refund reference"
                          value={payment.refundReference ?? "—"}
                          mono
                        />
                        {payment.nameCheckResult ? (
                          <DetailField
                            label="Name check result"
                            value={payment.nameCheckResult}
                          />
                        ) : null}
                        {payment.nameCheckAt ? (
                          <DetailField
                            label="Name check at"
                            value={formatDate(payment.nameCheckAt)}
                          />
                        ) : null}
                        {payment.refundedAt ? (
                          <DetailField
                            label="Refunded at"
                            value={formatDate(payment.refundedAt)}
                          />
                        ) : null}
                        {payment.refundNotes ? (
                          <DetailField label="Refund notes" value={payment.refundNotes} />
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                        <div className="space-y-1">
                          <CardTitle>Receipt</CardTitle>
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
                      <CardContent className="space-y-6">
                        {!payment.receipt ? (
                          <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-6">
                            <p className="text-base text-muted-foreground">
                              No receipt yet. A receipt is created after this payment is
                              successfully completed.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="grid gap-5 sm:grid-cols-2">
                              <DetailField
                                label="Receipt number"
                                value={payment.receipt.receiptNumber}
                                mono
                              />
                              <DetailField
                                label="Purpose"
                                value={payment.receipt.purposeLabel}
                              />
                              <DetailField
                                label="Payer / company"
                                value={
                                  payment.receipt.payerCompanyName ||
                                  payment.receipt.payerName ||
                                  "—"
                                }
                              />
                              <DetailField
                                label="Amount"
                                value={formatCurrency(payment.receipt.amount)}
                              />
                              <DetailField
                                label="Payment date"
                                value={formatDate(payment.receipt.paymentDate)}
                              />
                              <DetailField
                                label="Curlec order ID"
                                value={payment.receipt.curlecOrderId ?? "—"}
                                mono
                              />
                              <DetailField
                                label="Curlec payment ID"
                                value={payment.receipt.curlecPaymentId ?? "—"}
                                mono
                              />
                              {payment.receipt.relatedReferenceLabel &&
                              payment.receipt.relatedReference ? (
                                <DetailField
                                  label={payment.receipt.relatedReferenceLabel}
                                  value={payment.receipt.relatedReference}
                                  mono
                                />
                              ) : null}
                            </div>

                            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => void handleOpenReceiptPdf("view")}
                                  disabled={!payment.receipt.hasPdf || isPending}
                                  title={
                                    payment.receipt.hasPdf
                                      ? undefined
                                      : "PDF is not ready yet"
                                  }
                                >
                                  View PDF
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => void handleOpenReceiptPdf("download")}
                                  disabled={!payment.receipt.hasPdf || isPending}
                                  title={
                                    payment.receipt.hasPdf
                                      ? undefined
                                      : "PDF is not ready yet"
                                  }
                                >
                                  Download PDF
                                </Button>
                                {canManage &&
                                (payment.receipt.status === "PENDING" ||
                                  payment.receipt.status === "FAILED") ? (
                                  <Button
                                    onClick={() => void handleRetryReceipt()}
                                    disabled={isPending}
                                    title={disabledReason}
                                  >
                                    Retry generation
                                  </Button>
                                ) : null}
                              </div>
                              {!payment.receipt.hasPdf ? (
                                <p className="text-sm text-muted-foreground">
                                  {payment.receipt.status === "FAILED"
                                    ? "PDF generation failed. Retry to create the receipt file."
                                    : "PDF is still being prepared."}
                                </p>
                              ) : null}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    {showActionsCard ? (
                      <Card className="rounded-2xl shadow-sm">
                        <CardHeader>
                          <CardTitle>Actions</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Manage name checks and refunds for this payment.
                          </p>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                          {showReviewNameCheck ? (
                            <>
                              <Button
                                className="w-full"
                                onClick={() => void handleApproveNameCheck()}
                                disabled={!canManage || isPending}
                                title={disabledReason}
                              >
                                Approve name check
                              </Button>
                              <Button
                                className="w-full"
                                variant="destructive"
                                onClick={() => void handleRejectNameCheck()}
                                disabled={!canManage || isPending}
                                title={disabledReason}
                              >
                                Reject name check
                              </Button>
                            </>
                          ) : null}
                          {showRetryRefund ? (
                            <Button
                              className="w-full"
                              variant="destructive"
                              onClick={() => void handleRetryRefund()}
                              disabled={!canManage || isPending}
                              title={disabledReason}
                            >
                              Retry auto-refund
                            </Button>
                          ) : null}
                          {showInitiateRefund ? (
                            <Button
                              className="w-full"
                              variant="destructive"
                              onClick={() => setShowRefundDialog(true)}
                              disabled={!canManage || isPending}
                              title={disabledReason}
                            >
                              Initiate refund
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Event trail</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Status changes and admin actions for this payment.
                        </p>
                      </CardHeader>
                      <CardContent>
                        {payment.events.length === 0 ? (
                          <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-6">
                            <p className="text-sm text-muted-foreground">
                              No events recorded yet.
                            </p>
                          </div>
                        ) : (
                          <ol className="relative space-y-0 border-l border-border pl-5">
                            {payment.events.map((event) => {
                              const fromLabel = formatStatusLabel(event.fromStatus);
                              const toLabel = formatStatusLabel(event.toStatus);
                              return (
                                <li key={event.id} className="relative pb-6 last:pb-0">
                                  <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                      <p className="text-base font-medium text-foreground">
                                        {formatEventType(event.type)}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {formatDate(event.createdAt)}
                                      </p>
                                    </div>
                                    {fromLabel && toLabel ? (
                                      <p className="text-sm text-muted-foreground">
                                        {fromLabel}
                                        <span className="mx-1.5 text-muted-foreground/70">→</span>
                                        {toLabel}
                                      </p>
                                    ) : null}
                                    {event.reason ? (
                                      <p className="text-sm text-foreground/90">{event.reason}</p>
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
              </>
            )}
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
