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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useApproveGatewayPaymentNameCheck,
  useApproveGatewayPaymentOverride,
  useCompleteGatewayPaymentRefund,
  useGatewayPayment,
  useProposeGatewayPaymentOverride,
  useRecordGatewayPaymentRefund,
  useRejectGatewayPaymentNameCheck,
  useRejectGatewayPaymentOverride,
} from "@/hooks/use-gateway-payments";

type DialogAction =
  | { kind: "name-check-approve" }
  | { kind: "name-check-reject" }
  | { kind: "override-propose" }
  | { kind: "override-reject" }
  | { kind: "refund-record" };

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

  const approveNameCheck = useApproveGatewayPaymentNameCheck();
  const rejectNameCheck = useRejectGatewayPaymentNameCheck();
  const proposeOverride = useProposeGatewayPaymentOverride();
  const approveOverride = useApproveGatewayPaymentOverride();
  const rejectOverride = useRejectGatewayPaymentOverride();
  const recordRefund = useRecordGatewayPaymentRefund();
  const completeRefund = useCompleteGatewayPaymentRefund();

  const [dialogAction, setDialogAction] = React.useState<DialogAction | null>(null);
  const [refundReference, setRefundReference] = React.useState("");

  const isPending =
    approveNameCheck.isPending ||
    rejectNameCheck.isPending ||
    proposeOverride.isPending ||
    approveOverride.isPending ||
    rejectOverride.isPending ||
    recordRefund.isPending ||
    completeRefund.isPending;

  const canApproveNameCheck = Boolean(
    payment && canManage && payment.status === "NAME_CHECK_PENDING"
  );
  const canRejectNameCheck = canApproveNameCheck;
  const canProposeOverride = Boolean(
    payment && canManage && payment.status === "HELD" && !payment.openOverrideProposedBy
  );
  const canApproveOverride = Boolean(
    payment && canManage && payment.status === "HELD" && payment.openOverrideProposedBy
  );
  const canRejectOverride = canApproveOverride;
  const canRecordRefund = Boolean(
    payment &&
      canManage &&
      (payment.status === "HELD" || payment.status === "COMPLETED")
  );
  const canCompleteRefund = Boolean(
    payment && canManage && payment.status === "REFUND_INITIATED"
  );

  const handleRemarkConfirm = async (remark: string) => {
    if (!id || !dialogAction) return;

    try {
      if (dialogAction.kind === "name-check-approve") {
        await approveNameCheck.mutateAsync({ id, reason: remark });
        toast.success("Deposit credited after name check approval");
      } else if (dialogAction.kind === "name-check-reject") {
        await rejectNameCheck.mutateAsync({ id, reason: remark });
        toast.success("Deposit moved to held");
      } else if (dialogAction.kind === "override-propose") {
        await proposeOverride.mutateAsync({ id, reason: remark });
        toast.success("Override proposed — awaiting checker approval");
      } else if (dialogAction.kind === "override-reject") {
        await rejectOverride.mutateAsync({ id, reason: remark });
        toast.success("Override proposal rejected");
      } else if (dialogAction.kind === "refund-record") {
        if (!refundReference.trim()) {
          toast.error("Refund reference is required");
          return;
        }
        await recordRefund.mutateAsync({
          id,
          reference: refundReference.trim(),
          notes: remark || undefined,
        });
        toast.success("Refund recorded — complete in Curlec dashboard first");
        setRefundReference("");
      }
      setDialogAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleApproveOverride = async () => {
    if (!id) return;
    try {
      await approveOverride.mutateAsync(id);
      toast.success("Override approved — deposit credited");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Override approval failed");
    }
  };

  const handleCompleteRefund = async () => {
    if (!id) return;
    try {
      await completeRefund.mutateAsync({ id });
      toast.success("Refund marked complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete refund");
    }
  };

  const dialogCopy = (() => {
    switch (dialogAction?.kind) {
      case "name-check-approve":
        return {
          title: "Approve name check",
          description: "Credit this deposit after manual verification of the payer name.",
          submitLabel: "Approve and credit",
          variant: "default" as const,
        };
      case "name-check-reject":
        return {
          title: "Reject name check",
          description: "Move this deposit to held — no wallet credit.",
          submitLabel: "Reject",
          variant: "destructive" as const,
        };
      case "override-propose":
        return {
          title: "Propose override credit",
          description:
            "Propose crediting this held deposit despite the name mismatch. A different admin must approve.",
          submitLabel: "Propose override",
          variant: "default" as const,
        };
      case "override-reject":
        return {
          title: "Reject override proposal",
          description: "Reject the pending override without crediting the deposit.",
          submitLabel: "Reject proposal",
          variant: "destructive" as const,
        };
      case "refund-record":
        return {
          title: "Record refund initiated",
          description:
            "Record that a refund was initiated in the Curlec dashboard. Enter the reference below before confirming.",
          submitLabel: "Record refund",
          variant: "destructive" as const,
        };
      default:
        return null;
    }
  })();

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
                        {payment.investorOrganizationName ?? PURPOSE_LABEL[payment.purpose] ?? payment.purpose}
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
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p>{formatDate(payment.createdAt)}</p>
                    </div>
                    {payment.openOverrideReason ? (
                      <div className="md:col-span-2">
                        <p className="text-xs text-muted-foreground">Pending override</p>
                        <p>{payment.openOverrideReason}</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {canManage ? (
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle>Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {canApproveNameCheck ? (
                        <Button onClick={() => setDialogAction({ kind: "name-check-approve" })}>
                          Approve name check
                        </Button>
                      ) : null}
                      {canRejectNameCheck ? (
                        <Button
                          variant="destructive"
                          onClick={() => setDialogAction({ kind: "name-check-reject" })}
                        >
                          Reject name check
                        </Button>
                      ) : null}
                      {canProposeOverride ? (
                        <Button onClick={() => setDialogAction({ kind: "override-propose" })}>
                          Propose override credit
                        </Button>
                      ) : null}
                      {canApproveOverride ? (
                        <Button onClick={() => void handleApproveOverride()} disabled={isPending}>
                          Approve override (checker)
                        </Button>
                      ) : null}
                      {canRejectOverride ? (
                        <Button
                          variant="outline"
                          onClick={() => setDialogAction({ kind: "override-reject" })}
                        >
                          Reject override
                        </Button>
                      ) : null}
                      {canRecordRefund ? (
                        <>
                          <div className="w-full pt-2">
                            <Label htmlFor="refund-reference">Refund reference (Curlec dashboard)</Label>
                            <Input
                              id="refund-reference"
                              value={refundReference}
                              onChange={(event) => setRefundReference(event.target.value)}
                              placeholder="e.g. REF-12345"
                              className="mt-1 max-w-sm"
                            />
                          </div>
                          <Button
                            variant="destructive"
                            onClick={() => setDialogAction({ kind: "refund-record" })}
                            disabled={!refundReference.trim()}
                          >
                            Record refund initiated
                          </Button>
                        </>
                      ) : null}
                      {canCompleteRefund ? (
                        <Button variant="outline" onClick={() => void handleCompleteRefund()}>
                          Mark refund complete
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
                      <p className="text-sm text-muted-foreground">No admin events recorded yet.</p>
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

        {dialogCopy ? (
          <ApplicationReviewRemarkDialog
            open={dialogAction !== null}
            onOpenChange={(open) => {
              if (!open) setDialogAction(null);
            }}
            title={dialogCopy.title}
            description={dialogCopy.description}
            submitLabel={dialogCopy.submitLabel}
            variant={dialogCopy.variant}
            onConfirm={handleRemarkConfirm}
            isPending={isPending}
          />
        ) : null}
      </>
    </RequirePermission>
  );
}
