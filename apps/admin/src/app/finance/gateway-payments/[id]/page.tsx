"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { ApplicationReviewRemarkDialog } from "@/components/application-review-remark-dialog";
import { formatDate, PURPOSE_LABEL, STATUS_LABEL, statusVariant } from "@/components/gateway-payments-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useApproveGatewayNameCheck,
  useGatewayPayment,
  useInitiateGatewayPaymentRefund,
  useRejectGatewayNameCheck,
  useRetryGatewayPaymentRefund,
} from "@/hooks/use-gateway-payments";

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

export default function GatewayPaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : null;
  const { can } = usePermissions();
  const canManage = can("gateway_payments.manage");

  const { data: payment, isLoading, error, refetch, isFetching } = useGatewayPayment(id);
  const retryRefund = useRetryGatewayPaymentRefund();
  const initiateRefund = useInitiateGatewayPaymentRefund();
  const approveNameCheck = useApproveGatewayNameCheck();
  const rejectNameCheck = useRejectGatewayNameCheck();
  const [showRefundDialog, setShowRefundDialog] = React.useState(false);

  const isPending =
    retryRefund.isPending ||
    initiateRefund.isPending ||
    approveNameCheck.isPending ||
    rejectNameCheck.isPending;

  const canRetryRefund = Boolean(canManage && payment?.status === "HELD");
  const canReviewNameCheck = Boolean(canManage && payment?.status === "NAME_CHECK_PENDING");
  const canInitiateRefund = Boolean(
    canManage &&
      payment?.status === "COMPLETED" &&
      payment.purpose === "INVESTOR_DEPOSIT"
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

  return (
    <RequirePermission permission="gateway_payments.view">
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Gateway Payment</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 w-8 p-0"
              title="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <SystemHealthIndicator />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
            <Button asChild variant="outline" size="sm">
              <Link href="/finance/gateway-payments">
                <ArrowLeftIcon className="mr-1 h-4 w-4" />
                Back to list
              </Link>
            </Button>

            {isLoading ? (
              <DetailSkeleton />
            ) : error || !payment ? (
              <Card className="rounded-2xl">
                <CardContent className="py-8 text-destructive">
                  Failed to load gateway payment.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>{formatCurrency(payment.amount)}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {payment.investorOrganizationName ??
                          PURPOSE_LABEL[payment.purpose] ??
                          payment.purpose}
                      </p>
                    </div>
                    <Badge variant={statusVariant(payment.status)}>
                      {STATUS_LABEL[payment.status] ?? payment.status}
                    </Badge>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Expected payer</p>
                      <p>{payment.expectedPayerName ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">FPX payer name</p>
                      <p>{payment.payerName ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Curlec order</p>
                      <p className="font-mono text-sm">{payment.curlecOrderId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Curlec payment</p>
                      <p className="font-mono text-sm">{payment.curlecPaymentId ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bank</p>
                      <p>{payment.bankCode ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Refund reference</p>
                      <p className="font-mono text-sm">{payment.refundReference ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p>{formatDate(payment.createdAt)}</p>
                    </div>
                    {payment.refundedAt ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Refunded</p>
                        <p>{formatDate(payment.refundedAt)}</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {canManage && (canRetryRefund || canInitiateRefund || canReviewNameCheck) ? (
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle>Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {canReviewNameCheck ? (
                        <>
                          <Button onClick={() => void handleApproveNameCheck()} disabled={isPending}>
                            Approve name check
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => void handleRejectNameCheck()}
                            disabled={isPending}
                          >
                            Reject name check
                          </Button>
                        </>
                      ) : null}
                      {canRetryRefund ? (
                        <Button
                          variant="destructive"
                          onClick={() => void handleRetryRefund()}
                          disabled={isPending}
                        >
                          Retry auto-refund
                        </Button>
                      ) : null}
                      {canInitiateRefund ? (
                        <Button
                          variant="destructive"
                          onClick={() => setShowRefundDialog(true)}
                          disabled={isPending}
                        >
                          Initiate refund
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Event trail</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {payment.events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                    ) : (
                      payment.events.map((event) => (
                        <div key={event.id} className="border-b pb-3 last:border-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{event.type.replace(/_/g, " ")}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(event.createdAt)}
                            </p>
                          </div>
                          {event.fromStatus && event.toStatus ? (
                            <p className="text-sm text-muted-foreground">
                              {event.fromStatus} → {event.toStatus}
                            </p>
                          ) : null}
                          {event.reason ? (
                            <p className="mt-1 text-sm">{event.reason}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
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
