"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { formatAuditDate } from "@/components/audit/audit-presentation";
import { ArrowPathIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { toTitleCase, formatNoteReference } from "@cashsouk/types";
import { Skeleton, StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePendingRepayments } from "@/notes/hooks/use-notes";
import { RequirePermission } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOURCE_LABEL: Record<string, string> = {
  PAYMASTER: "Paymaster",
  ISSUER_ON_BEHALF: "Issuer on behalf",
  MANUAL: "Manual",
  OTHER: "Other",
};

const ACTION_COPY: Record<string, { label: string; status: "action" | "submitted" | "neutral" }> = {
  REVIEW: { label: "Review & approve", status: "action" },
  AWAIT_REMAINDER: { label: "Awaiting remainder", status: "submitted" },
  POST_SETTLEMENT: { label: "Ready for settlement", status: "action" },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return formatAuditDate(value);
}

function formatAge(value: string | null) {
  if (!value) return "—";
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export default function PendingRepaymentsPage() {
  const { data, isLoading, error, refetch, isFetching } = usePendingRepayments();
  const items = data?.items ?? [];

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const reviewCount = items.filter((item) => item.actionNeeded === "REVIEW").length;
  const readyForSettlementCount = items.filter(
    (item) => item.actionNeeded === "POST_SETTLEMENT"
  ).length;

  return (
    <RequirePermission permission="repayments.view">
      <>
            <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
          <section className="space-y-4">
            <AdminPageHeader
              title="Repayments"
              description={
                <>
                  Every payment that has not yet been allocated to a posted settlement. Issuer-submitted
                  receipts need <span className="font-medium">Review &amp; approve</span>; admin-recorded
                  receipts sit in <span className="font-medium">Ready for settlement</span> until the
                  waterfall is posted. Items leave this queue once their settlement is posted or the
                  payment is voided.
                </>
              }
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  className="h-8 w-8 shrink-0 p-0"
                  title="Refresh"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                </Button>
              }
            />

            {error ? (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load pending repayments"}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Open items</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : items.length}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Total amount</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrency(totalAmount)}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Need review</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : reviewCount}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Ready for settlement</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : readyForSettlementCount}
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Note</TableHead>
                      <TableHead>Issuer</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Proof</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action needed</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 4 }).map((_, idx) => (
                          <TableRow key={idx}>
                            {Array.from({ length: 11 }).map((__, jdx) => (
                              <TableCell key={jdx}>
                                <Skeleton className="h-5 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : items.length === 0
                        ? (
                            <TableRow>
                              <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                                No pending repayments. New receipts will appear here as they are recorded.
                              </TableCell>
                            </TableRow>
                          )
                        : items.map((item) => (
                            <TableRow
                              key={item.paymentId}
                              className={adminActionRowClass(
                                getAdminStatusToken(item.status) === "action" ||
                                  ACTION_COPY[item.actionNeeded]?.status === "action"
                              )}
                            >
                              <TableCell className="font-medium">
                                {formatNoteReference({
                                  noteReference: item.noteReference,
                                  id: item.noteId,
                                })}
                              </TableCell>
                              <TableCell>{item.issuerOrganizationName ?? "—"}</TableCell>
                              <TableCell>
                                {SOURCE_LABEL[item.source] ?? item.source}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {item.reference ?? "—"}
                              </TableCell>
                              <TableCell>
                                {item.evidenceFiles?.length ? (
                                  <span className="text-sm text-foreground">Proof received</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(item.amount)}
                              </TableCell>
                              <TableCell>{formatDate(item.receivedAt)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatAge(item.receivedAt ?? item.createdAt)}
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  label={toTitleCase(item.status)}
                                  status={getAdminStatusToken(item.status)}
                                />
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  label={ACTION_COPY[item.actionNeeded]?.label ?? toTitleCase(item.actionNeeded)}
                                  status={ACTION_COPY[item.actionNeeded]?.status ?? "neutral"}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button asChild variant="ghost" size="sm" className="gap-1">
                                  <Link href={`/notes/${item.noteId}`}>
                                    Open
                                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
      </>
    </RequirePermission>
  );
}
