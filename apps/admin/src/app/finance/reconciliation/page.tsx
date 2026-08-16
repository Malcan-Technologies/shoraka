"use client";

import { useHeader } from "@cashsouk/ui";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequirePermission } from "@/components/require-permission";
import { ApplicationReviewRemarkDialog } from "@/components/application-review-remark-dialog";
import { ContextualAuditHistoryPanel } from "@/components/audit/contextual-audit-history-panel";
import { paymentAuditToDetail } from "@/components/audit/contextual-audit-mappers";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePermissions } from "@/hooks/use-permissions";
import { useReconExceptionAudit } from "@/hooks/use-recon-exception-audit";
import {
  GATEWAY_ACCOUNT_OPTIONS,
  getGatewayAccountBadgeClassName,
  getGatewayAccountLabel,
} from "@/lib/gateway-account";
import {
  useGatewayReconExceptions,
  useGatewayReconRuns,
  useResolveGatewayReconException,
  useTriggerGatewayReconRun,
} from "@/hooks/use-gateway-recon";
import type { GatewayReconExceptionDto } from "@cashsouk/types";

const RUN_STATUS_LABEL: Record<string, string> = {
  RUNNING: "Running",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

const EXCEPTION_TYPE_LABEL: Record<string, string> = {
  ORPHAN_CURLEC_PAYMENT: "Orphan Curlec payment",
  AMOUNT_MISMATCH: "Amount mismatch",
};

function runStatusVariant(status: string) {
  if (status === "COMPLETED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  return "secondary" as const;
}

function formatDate(value: string) {
  return format(new Date(value), "dd MMM yyyy, h:mm a");
}

function ReconExceptionAuditSheet({
  exception,
  open,
  onOpenChange,
}: {
  exception: GatewayReconExceptionDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useReconExceptionAudit(exception?.id ?? null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Audit History</SheetTitle>
          <SheetDescription>
            Raw forensic audit records for this reconciliation exception.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <ContextualAuditHistoryPanel
            variant="plain"
            detailMode="inline"
            rows={(data ?? []).map(paymentAuditToDetail)}
            isLoading={isLoading}
            error={error instanceof Error ? error : null}
            emptyMessage="No audit records found"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ReconciliationPage() {
  const { setTitle } = useHeader();
  useEffect(() => {
    setTitle("Gateway Reconciliation");
    return () => setTitle("");
  }, [setTitle]);

  const { can } = usePermissions();
  const canManage = can("gateway_reconciliation.manage");
  const disabledReason = !canManage ? "You do not have permission to perform this action." : undefined;

  const [runDate, setRunDate] = useState("");
  const [runGatewayAccount, setRunGatewayAccount] = useState<"">("");
  const [accountFilter, setAccountFilter] = useState<"ALL" | (typeof GATEWAY_ACCOUNT_OPTIONS)[number]["value"]>(
    "ALL"
  );
  const [exceptionStatus, setExceptionStatus] = useState<"open" | "resolved">("open");
  const [resolveTarget, setResolveTarget] = useState<GatewayReconExceptionDto | null>(null);
  const [auditTarget, setAuditTarget] = useState<GatewayReconExceptionDto | null>(null);

  const {
    data: runsData,
    isLoading: runsLoading,
    error: runsError,
    refetch: refetchRuns,
    isFetching: runsFetching,
  } = useGatewayReconRuns({
    page: 1,
    pageSize: 20,
    gatewayAccount: accountFilter === "ALL" ? undefined : accountFilter,
  });

  const {
    data: openExceptionsData,
    refetch: refetchOpenExceptions,
  } = useGatewayReconExceptions({
    page: 1,
    pageSize: 50,
    resolved: false,
    gatewayAccount: accountFilter === "ALL" ? undefined : accountFilter,
  });

  const {
    data: exceptionsData,
    isLoading: exceptionsLoading,
    error: exceptionsError,
    refetch: refetchExceptions,
    isFetching: exceptionsFetching,
  } = useGatewayReconExceptions({
    page: 1,
    pageSize: 50,
    resolved: exceptionStatus === "resolved",
    gatewayAccount: accountFilter === "ALL" ? undefined : accountFilter,
  });

  const triggerRun = useTriggerGatewayReconRun();
  const resolveException = useResolveGatewayReconException();

  const latestRun = runsData?.items[0] ?? null;
  const exceptions = exceptionsData?.items ?? [];

  function formatExceptionDetail(detail: string | null) {
    if (!detail) return "—";
    if (detail.includes("Payment ID is linked to another Curlec account")) {
      return "Payment ID was found under a different Curlec account. No payment was updated.";
    }
    return detail;
  }

  async function handleTriggerRun() {
    if (!runGatewayAccount) {
      toast.error("Select a gateway account before running reconciliation");
      return;
    }

    try {
      await triggerRun.mutateAsync({
        gatewayAccount: runGatewayAccount,
        ...(runDate.trim() ? { runDate: runDate.trim() } : {}),
      });
      toast.success(`Reconciliation run completed for ${getGatewayAccountLabel(runGatewayAccount)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reconciliation run failed";
      toast.error(`${getGatewayAccountLabel(runGatewayAccount)}: ${message}`);
    }
  }

  async function handleResolveConfirm(reason: string) {
    if (!resolveTarget) return;
    try {
      await resolveException.mutateAsync({ id: resolveTarget.id, reason });
      toast.success("Exception marked resolved");
      setResolveTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve exception");
    }
  }

  const isRefreshing = runsFetching || exceptionsFetching;
  const isPending = triggerRun.isPending || resolveException.isPending;

  return (
    <RequirePermission permission="gateway_reconciliation.view">
      <>
        
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-muted-foreground max-w-3xl">
              Daily settlement reconciliation against Curlec. Unresolved exceptions need manual
              review before they can be cleared from the queue.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void refetchRuns();
                void refetchExceptions();
                void refetchOpenExceptions();
              }}
              disabled={isRefreshing}
              className="h-8 w-8 shrink-0 p-0"
              title="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Run reconciliation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div>
                <Label htmlFor="recon-run-date">Run date (MYT, optional)</Label>
                <Input
                  id="recon-run-date"
                  type="date"
                  value={runDate}
                  onChange={(event) => setRunDate(event.target.value)}
                  className="mt-1 w-48"
                  disabled={!canManage}
                  title={disabledReason}
                />
                <p className="mt-1 text-xs opacity-70">Leave blank to reconcile yesterday (MYT).</p>
              </div>
              <div>
                <Label htmlFor="recon-gateway-account">Gateway account</Label>
                <Select
                  value={runGatewayAccount}
                  onValueChange={(value) => setRunGatewayAccount(value as typeof runGatewayAccount)}
                  disabled={!canManage}
                >
                  <SelectTrigger
                    id="recon-gateway-account"
                    className="mt-1 w-56"
                    title={disabledReason}
                  >
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {GATEWAY_ACCOUNT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => void handleTriggerRun()}
                disabled={!canManage || isPending}
                title={disabledReason}
              >
                Run now
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div>
                <Label htmlFor="recon-account-filter">Gateway account</Label>
                <Select
                  value={accountFilter}
                  onValueChange={(value) => setAccountFilter(value as typeof accountFilter)}
                >
                  <SelectTrigger id="recon-account-filter" className="mt-1 w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Accounts</SelectItem>
                    {GATEWAY_ACCOUNT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recon-exception-status">Exception status</Label>
                <Select
                  value={exceptionStatus}
                  onValueChange={(value) => setExceptionStatus(value as typeof exceptionStatus)}
                >
                  <SelectTrigger id="recon-exception-status" className="mt-1 w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Latest run
                </CardTitle>
              </CardHeader>
              <CardContent>
                {runsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : latestRun ? (
                  <>
                    <p className="text-2xl font-semibold">{latestRun.runDate}</p>
                    <Badge variant={runStatusVariant(latestRun.status)} className="mt-2">
                      {RUN_STATUS_LABEL[latestRun.status] ?? latestRun.status}
                    </Badge>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No runs yet</p>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Payments stamped
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{latestRun?.paymentsStamped ?? "—"}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Exceptions (latest run)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{latestRun?.exceptionsCount ?? "—"}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Open exceptions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{openExceptionsData?.total ?? "—"}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Reconciliation runs</CardTitle>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : runsError ? (
                <p className="text-destructive text-sm">Failed to load runs.</p>
              ) : (runsData?.items.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No reconciliation runs recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Gateway account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scanned</TableHead>
                      <TableHead>Matched</TableHead>
                      <TableHead>Stamped</TableHead>
                      <TableHead>Exceptions</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runsData?.items.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>{run.runDate}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getGatewayAccountBadgeClassName(run.gatewayAccount)}
                            >
                              {getGatewayAccountLabel(run.gatewayAccount)}
                            </Badge>
                          </TableCell>
                        <TableCell>
                          <Badge variant={runStatusVariant(run.status)}>
                            {RUN_STATUS_LABEL[run.status] ?? run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{run.settlementsScanned}</TableCell>
                        <TableCell>{run.paymentsMatched}</TableCell>
                        <TableCell>{run.paymentsStamped}</TableCell>
                        <TableCell>{run.exceptionsCount}</TableCell>
                        <TableCell>
                          {run.completedAt ? formatDate(run.completedAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>
                {exceptionStatus === "resolved" ? "Resolved exceptions" : "Open exceptions"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exceptionsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : exceptionsError ? (
                <p className="text-destructive text-sm">Failed to load exceptions.</p>
              ) : exceptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {exceptionStatus === "resolved"
                    ? "No resolved exceptions."
                    : "No open exceptions."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run date</TableHead>
                      <TableHead>Gateway account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Curlec payment</TableHead>
                      <TableHead>Settlement ID</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Detail</TableHead>
                      <TableHead>Created</TableHead>
                      {exceptionStatus === "resolved" ? <TableHead>Resolved</TableHead> : null}
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.runDate}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getGatewayAccountBadgeClassName(item.gatewayAccount)}
                          >
                            {getGatewayAccountLabel(item.gatewayAccount)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {EXCEPTION_TYPE_LABEL[item.type] ?? item.type}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.curlecPaymentId ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.curlecSettlementId ?? "—"}
                        </TableCell>
                        <TableCell>
                          {item.expectedAmount != null
                            ? formatCurrency(item.expectedAmount)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {item.actualAmount != null ? formatCurrency(item.actualAmount) : "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{formatExceptionDetail(item.detail)}</TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                        {exceptionStatus === "resolved" ? (
                          <TableCell>
                            {item.resolvedAt ? formatDate(item.resolvedAt) : "—"}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAuditTarget(item)}
                            >
                              Audit
                            </Button>
                            {exceptionStatus === "open" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setResolveTarget(item)}
                                disabled={!canManage}
                                title={disabledReason}
                              >
                                Resolve
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {resolveTarget ? (
          <ApplicationReviewRemarkDialog
            open={resolveTarget !== null}
            onOpenChange={(open) => {
              if (!open) setResolveTarget(null);
            }}
            title="Resolve reconciliation exception"
            description="Record why this exception is resolved (e.g. manual Curlec adjustment verified)."
            submitLabel="Mark resolved"
            onConfirm={handleResolveConfirm}
            isPending={isPending}
          />
        ) : null}

        <ReconExceptionAuditSheet
          exception={auditTarget}
          open={auditTarget !== null}
          onOpenChange={(open) => {
            if (!open) setAuditTarget(null);
          }}
        />
      </>
    </RequirePermission>
  );
}
