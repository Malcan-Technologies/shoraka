"use client";

import { useHeader } from "@cashsouk/ui";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
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
  PENDING: "Generating",
  GENERATED: "Ready",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

function receiptStatusVariant(status: string) {
  if (status === "GENERATED") return "success" as const;
  if (status === "FAILED") return "destructive" as const;
  if (status === "REFUNDED") return "secondary" as const;
  if (status === "PENDING") return "warning" as const;
  return "outline" as const;
}

const EVENT_COPY: Record<string, { title: string; description: string }> = {
  NAME_CHECK: {
    title: "Name check needed",
    description:
      "Payment received, but the bank name could not be matched to the investor profile. Waiting for admin review.",
  },
  NAME_CHECK_APPROVED: {
    title: "Name check approved",
    description: "Admin confirmed the names match. Deposit was completed and credited.",
  },
  NAME_CHECK_REJECTED: {
    title: "Name check rejected",
    description: "Admin rejected the name match. A refund was started.",
  },
  CAPTURE_MISMATCH: {
    title: "Amount mismatch",
    description:
      "The amount paid does not match what we expected. Payment was held for ops attention.",
  },
  EXPIRED: {
    title: "Checkout expired",
    description: "The payment link timed out before the customer finished paying.",
  },
  OVERRIDE_PROPOSED: {
    title: "Status override proposed",
    description: "An admin asked to manually change this payment’s status. Needs another admin to approve.",
  },
  OVERRIDE_APPROVED: {
    title: "Status override approved",
    description: "Another admin approved the manual status change.",
  },
  OVERRIDE_REJECTED: {
    title: "Status override rejected",
    description: "Another admin rejected the manual status change. No change was applied.",
  },
  REFUND_INITIATED: {
    title: "Refund started",
    description: "A refund was sent to Curlec. Waiting for the bank to confirm.",
  },
  REFUND_WALLET_REVERSAL_FAILED: {
    title: "Wallet debit failed after refund",
    description:
      "Curlec refunded the money, but removing it from the investor wallet failed. Ops must fix the wallet.",
  },
  REFUNDED: {
    title: "Refund completed",
    description: "Curlec confirmed the refund. Money was returned to the payer.",
  },
};

/** Known machine reason codes → plain English. */
const REASON_COPY: Record<string, string> = {
  AMOUNT_MISMATCH: "Paid amount does not match the expected amount.",
  NAME_MISMATCH: "Bank payer name does not match the investor profile name.",
  NAME_UNAVAILABLE: "Bank did not return a payer name.",
  ADMIN_INITIATED: "An admin started this action.",
};

function looksLikeReasonCode(value: string) {
  return /^[A-Z][A-Z0-9_]+$/.test(value.trim());
}

function formatEventTitle(type: string) {
  if (EVENT_COPY[type]) return EVENT_COPY[type].title;
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatEventDescription(type: string, reason: string | null) {
  if (reason) {
    const trimmed = reason.trim();
    const mapped = REASON_COPY[trimmed];
    if (mapped) return mapped;
    if (!looksLikeReasonCode(trimmed)) return trimmed;
  }
  return EVENT_COPY[type]?.description ?? null;
}

/** Temporary preview: every GatewayPaymentEventType label ops may see. */
const PREVIEW_TIMELINE_EVENTS: Array<{
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: string;
}> = [
  {
    id: "preview-refunded",
    type: "REFUNDED",
    fromStatus: "REFUND_INITIATED",
    toStatus: "REFUNDED",
    reason: null,
    createdAt: "2026-08-03T10:30:00.000Z",
  },
  {
    id: "preview-refund-wallet-failed",
    type: "REFUND_WALLET_REVERSAL_FAILED",
    fromStatus: "REFUND_INITIATED",
    toStatus: "HELD",
    reason: null,
    createdAt: "2026-08-03T10:29:00.000Z",
  },
  {
    id: "preview-refund-initiated",
    type: "REFUND_INITIATED",
    fromStatus: "COMPLETED",
    toStatus: "REFUND_INITIATED",
    reason: "ADMIN_INITIATED",
    createdAt: "2026-08-03T10:28:00.000Z",
  },
  {
    id: "preview-name-check-rejected",
    type: "NAME_CHECK_REJECTED",
    fromStatus: "NAME_CHECK_PENDING",
    toStatus: "REFUND_INITIATED",
    reason: null,
    createdAt: "2026-08-03T10:27:00.000Z",
  },
  {
    id: "preview-name-check-approved",
    type: "NAME_CHECK_APPROVED",
    fromStatus: "NAME_CHECK_PENDING",
    toStatus: "COMPLETED",
    reason: null,
    createdAt: "2026-08-03T10:26:00.000Z",
  },
  {
    id: "preview-name-check",
    type: "NAME_CHECK",
    fromStatus: "PAID",
    toStatus: "NAME_CHECK_PENDING",
    reason: "NAME_UNAVAILABLE",
    createdAt: "2026-08-03T10:25:00.000Z",
  },
  {
    id: "preview-capture-mismatch",
    type: "CAPTURE_MISMATCH",
    fromStatus: "PAID",
    toStatus: "HELD",
    reason: "AMOUNT_MISMATCH",
    createdAt: "2026-08-03T10:24:00.000Z",
  },
  {
    id: "preview-expired",
    type: "EXPIRED",
    fromStatus: "CREATED",
    toStatus: "EXPIRED",
    reason: null,
    createdAt: "2026-08-03T10:23:00.000Z",
  },
  {
    id: "preview-override-rejected",
    type: "OVERRIDE_REJECTED",
    fromStatus: null,
    toStatus: null,
    reason: null,
    createdAt: "2026-08-03T10:22:00.000Z",
  },
  {
    id: "preview-override-approved",
    type: "OVERRIDE_APPROVED",
    fromStatus: null,
    toStatus: null,
    reason: null,
    createdAt: "2026-08-03T10:21:00.000Z",
  },
  {
    id: "preview-override-proposed",
    type: "OVERRIDE_PROPOSED",
    fromStatus: null,
    toStatus: null,
    reason: null,
    createdAt: "2026-08-03T10:20:00.000Z",
  },
];

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

  const FORCE_GATEWAY_ACTION_PREVIEWS = true;

  const showReviewNameCheck =
    FORCE_GATEWAY_ACTION_PREVIEWS || payment?.status === "NAME_CHECK_PENDING";
  const showRetryRefund =
    FORCE_GATEWAY_ACTION_PREVIEWS || payment?.status === "HELD";
  const showInitiateRefund =
    FORCE_GATEWAY_ACTION_PREVIEWS ||
    (payment?.status === "COMPLETED" && payment.purpose === "INVESTOR_DEPOSIT");
  const showNameCheckCard = showReviewNameCheck;
  const showHeldRefundCard = showRetryRefund;
  const timelineEvents = FORCE_GATEWAY_ACTION_PREVIEWS
    ? PREVIEW_TIMELINE_EVENTS
    : (payment?.events ?? []);

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
            className="gap-1.5"
            title="Reload this payment from the server"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
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

                {showNameCheckCard ? (
                  <Card
                    className={cn(
                      "rounded-2xl",
                      "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Next action — name check</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Manual review when the automatic name check could not approve this
                        payment. Approve to credit the deposit, or reject to refund.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">Investor profile name</p>
                          <p className="mt-1 text-sm font-medium">
                            {payment.expectedPayerName ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">FPX returned name</p>
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
                      <CardTitle className="text-base">Next action — retry refund</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Auto-refund did not finish. Retry the Curlec refund.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                    </CardContent>
                  </Card>
                ) : null}

                {showInitiateRefund ? (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Refund</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Initiate a Curlec refund for this completed investor deposit when a
                        post-credit correction is required.
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
                        Initiate refund
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                {/* Main + side — same grid as note detail */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                  <div className="min-w-0 space-y-6">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Payment details</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          For investor deposits, compare the investor profile name with the
                          FPX returned name. Also shows Curlec references.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <dl className="space-y-2.5">
                          {!showReviewNameCheck ? (
                            <>
                              <DetailRow
                                label="Investor profile name"
                                value={payment.expectedPayerName ?? "—"}
                              />
                              <DetailRow
                                label="FPX returned name"
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

                    {FORCE_GATEWAY_ACTION_PREVIEWS ? (
                      <>
                        <Card className="rounded-2xl border-dashed">
                          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                            <div className="space-y-1">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                                Receipt — not created
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Preview: before receipt exists.
                              </p>
                            </div>
                            <Badge variant="outline">Not created</Badge>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-xl border border-dashed bg-muted/20 p-4">
                              <p className="text-sm font-medium">No receipt yet</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                A receipt is created after this payment is successfully
                                completed.
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-dashed">
                          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                            <div className="space-y-1">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                                Receipt — failed
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Preview: receipt generation failed; admin can retry.
                              </p>
                            </div>
                            <Badge variant={receiptStatusVariant("FAILED")}>
                              {RECEIPT_STATUS_LABEL.FAILED}
                            </Badge>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <dl className="space-y-2.5">
                              <DetailRow label="Receipt number" value="RCP-PREVIEW-FAILED" mono />
                              <DetailRow label="Receipt name" value="—" />
                              <DetailRow label="Receipt company" value="—" />
                              <DetailRow
                                label="Payment date"
                                value={formatDate(payment.createdAt)}
                              />
                            </dl>
                            <div className="flex flex-wrap gap-2 border-t pt-4">
                              <Button variant="outline" size="sm" disabled>
                                View PDF
                              </Button>
                              <Button variant="outline" size="sm" disabled>
                                Download PDF
                              </Button>
                              <Button size="sm" disabled={!canManage} title={disabledReason}>
                                Retry
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Creating the receipt failed (error while building or uploading
                              the file). Retry runs it again.
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-dashed">
                          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                            <div className="space-y-1">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                                Receipt — preparing
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Preview: receipt is still generating.
                              </p>
                            </div>
                            <Badge variant={receiptStatusVariant("PENDING")}>
                              {RECEIPT_STATUS_LABEL.PENDING}
                            </Badge>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <dl className="space-y-2.5">
                              <DetailRow
                                label="Receipt number"
                                value="RCP-PREVIEW-PENDING"
                                mono
                              />
                              <DetailRow label="Receipt name" value="—" />
                              <DetailRow label="Receipt company" value="—" />
                              <DetailRow
                                label="Payment date"
                                value={formatDate(payment.createdAt)}
                              />
                            </dl>
                            <div className="flex flex-wrap gap-2 border-t pt-4">
                              <Button variant="outline" size="sm" disabled>
                                View PDF
                              </Button>
                              <Button variant="outline" size="sm" disabled>
                                Download PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!canManage}
                                title={disabledReason}
                              >
                                Retry
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Receipt row exists; file is not ready yet. Usually finishes in
                              the background. Retry if it stays like this.
                            </p>
                          </CardContent>
                        </Card>
                      </>
                    ) : null}

                    <Card className="rounded-2xl">
                      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                            Receipt
                            {FORCE_GATEWAY_ACTION_PREVIEWS ? " — live" : ""}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Names printed on the official receipt (may differ from bank
                            name check fields above).
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
                                label="Receipt name"
                                value={payment.receipt.payerName || "—"}
                              />
                              <DetailRow
                                label="Receipt company"
                                value={payment.receipt.payerCompanyName || "—"}
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
                                  variant={
                                    payment.receipt.status === "FAILED" ? "default" : "outline"
                                  }
                                  onClick={() => void handleRetryReceipt()}
                                  disabled={isPending}
                                  title={disabledReason}
                                >
                                  Retry
                                </Button>
                              ) : null}
                            </div>
                            {!payment.receipt.hasPdf ? (
                              <p className="text-xs text-muted-foreground">
                                {payment.receipt.status === "FAILED"
                                  ? "Creating the receipt failed (error while building or uploading the file). Retry runs it again."
                                  : "Receipt row exists; file is not ready yet. Usually finishes in the background. Retry if it stays like this."}
                              </p>
                            ) : null}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="min-w-0 space-y-6">
                    <Card className="flex flex-col overflow-hidden rounded-2xl">
                      <CardHeader className="shrink-0 pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ClipboardDocumentCheckIcon className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-base font-semibold">
                              Activity Timeline
                            </CardTitle>
                          </div>
                          {timelineEvents.length > 0 ? (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                              {timelineEvents.length}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {FORCE_GATEWAY_ACTION_PREVIEWS
                            ? "Preview: every gateway event type (newest first)"
                            : "Status changes and admin actions for this payment"}
                        </p>
                      </CardHeader>
                      <CardContent className="min-h-0 overflow-hidden !px-0">
                        {timelineEvents.length === 0 ? (
                          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                            No activity logs found
                          </div>
                        ) : (
                          <div className="px-6 pb-6">
                            <div className="relative">
                              <div className="absolute bottom-2 left-[5px] top-2 w-px bg-border" />
                              <div className="space-y-5">
                                {timelineEvents.map((event, index) => {
                                  const fromLabel = formatStatusLabel(event.fromStatus);
                                  const toLabel = formatStatusLabel(event.toStatus);
                                  const description = formatEventDescription(
                                    event.type,
                                    event.reason
                                  );
                                  return (
                                    <div key={event.id} className="relative flex gap-3 pl-0">
                                      <div
                                        className={cn(
                                          "relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-card bg-primary",
                                          index === 0 && "ring-2 ring-primary/20"
                                        )}
                                      />
                                      <div className="-mt-0.5 min-w-0 flex-1">
                                        <p className="text-sm font-medium leading-tight text-foreground">
                                          {formatEventTitle(event.type)}
                                        </p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                          {formatDate(event.createdAt)}
                                        </p>
                                        {fromLabel && toLabel ? (
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {fromLabel} → {toLabel}
                                          </p>
                                        ) : null}
                                        {description ? (
                                          <p className="mt-1 text-xs leading-5 text-foreground/90">
                                            {description}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
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
