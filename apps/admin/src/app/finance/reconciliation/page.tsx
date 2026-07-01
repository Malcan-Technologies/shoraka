"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { RequirePermission } from "@/components/require-permission";
import { ApplicationReviewRemarkDialog } from "@/components/application-review-remark-dialog";
import { usePermissions } from "@/hooks/use-permissions";
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

export default function ReconciliationPage() {
  const { can } = usePermissions();
  const canManage = can("gateway_payments.manage");

  const [runDate, setRunDate] = useState("");
  const [resolveTarget, setResolveTarget] = useState<GatewayReconExceptionDto | null>(null);

  const {
    data: runsData,
    isLoading: runsLoading,
    error: runsError,
    refetch: refetchRuns,
    isFetching: runsFetching,
  } = useGatewayReconRuns({ page: 1, pageSize: 20 });

  const {
    data: exceptionsData,
    isLoading: exceptionsLoading,
    error: exceptionsError,
    refetch: refetchExceptions,
    isFetching: exceptionsFetching,
  } = useGatewayReconExceptions({ page: 1, pageSize: 50, resolved: false });

  const triggerRun = useTriggerGatewayReconRun();
  const resolveException = useResolveGatewayReconException();

  const latestRun = runsData?.items[0] ?? null;
  const exceptions = exceptionsData?.items ?? [];

  async function handleTriggerRun() {
    try {
      await triggerRun.mutateAsync(runDate.trim() ? { runDate: runDate.trim() } : undefined);
      toast.success("Reconciliation run completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reconciliation run failed");
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
    <RequirePermission permission="gateway_payments.view">
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Gateway Reconciliation</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void refetchRuns();
                void refetchExceptions();
              }}
              disabled={isRefreshing}
              className="h-8 w-8 p-0"
              title="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <SystemHealthIndicator />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <p className="text-muted-foreground max-w-3xl">
            Daily settlement reconciliation against Curlec. Unresolved exceptions need manual
            review before they can be cleared from the queue.
          </p>

          {canManage ? (
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
                  />
                  <p className="mt-1 text-xs opacity-70">Leave blank to reconcile yesterday (MYT).</p>
                </div>
                <Button onClick={() => void handleTriggerRun()} disabled={isPending}>
                  Run now
                </Button>
              </CardContent>
            </Card>
          ) : null}

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
                <p className="text-2xl font-semibold">{exceptionsData?.total ?? "—"}</p>
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
              <CardTitle>Open exceptions</CardTitle>
            </CardHeader>
            <CardContent>
              {exceptionsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : exceptionsError ? (
                <p className="text-destructive text-sm">Failed to load exceptions.</p>
              ) : exceptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open exceptions.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Curlec payment</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Detail</TableHead>
                      <TableHead>Created</TableHead>
                      {canManage ? <TableHead /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {EXCEPTION_TYPE_LABEL[item.type] ?? item.type}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.curlecPaymentId ?? "—"}
                        </TableCell>
                        <TableCell>
                          {item.expectedAmount != null
                            ? formatCurrency(item.expectedAmount)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {item.actualAmount != null ? formatCurrency(item.actualAmount) : "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{item.detail ?? "—"}</TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                        {canManage ? (
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setResolveTarget(item)}
                            >
                              Resolve
                            </Button>
                          </TableCell>
                        ) : null}
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
      </>
    </RequirePermission>
  );
}
