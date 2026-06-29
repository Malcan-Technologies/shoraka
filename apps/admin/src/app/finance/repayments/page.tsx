"use client";

import * as React from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowPathIcon, BanknotesIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Skeleton } from "@cashsouk/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePendingRepayments } from "@/notes/hooks/use-notes";
import { RequirePermission } from "@/components/require-permission";

const SOURCE_LABEL: Record<string, string> = {
  PAYMASTER: "Paymaster",
  ISSUER_ON_BEHALF: "Issuer on behalf",
  MANUAL: "Manual",
  OTHER: "Other",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  PARTIAL: "outline",
  RECEIVED: "default",
  RECONCILED: "default",
};

const ACTION_COPY: Record<string, { label: string; tone: string }> = {
  REVIEW: {
    label: "Review & approve",
    tone: "border-amber-300 bg-amber-50 text-amber-950",
  },
  AWAIT_REMAINDER: {
    label: "Awaiting remainder",
    tone: "border-slate-300 bg-slate-50 text-slate-900",
  },
  POST_SETTLEMENT: {
    label: "Ready for settlement",
    tone: "border-sky-300 bg-sky-50 text-sky-950",
  },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy");
}

function formatAge(value: string | null) {
  if (!value) return "—";
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export default function PendingRepaymentsPage() {
  const { data, isLoading, error, refetch, isFetching } = usePendingRepayments();
  const { viewDocumentPending, handleViewDocument, handleDownloadDocument } =
    useAdminS3DocumentViewDownload();
  const items = data?.items ?? [];

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const reviewCount = items.filter((item) => item.actionNeeded === "REVIEW").length;
  const readyForSettlementCount = items.filter(
    (item) => item.actionNeeded === "POST_SETTLEMENT"
  ).length;

  return (
    <RequirePermission permission="repayments.view">
      <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Pending Repayments</h1>
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
        <div className="w-full space-y-8 px-4 py-10 md:px-6 md:py-12 lg:px-8">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BanknotesIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Repayments awaiting action</h2>
                <p className="text-sm text-muted-foreground">
                  Every payment that has not yet been allocated to a posted settlement. Issuer-submitted
                  receipts need <span className="font-medium">Review &amp; approve</span>; admin-recorded
                  receipts sit in <span className="font-medium">Ready for settlement</span> until the
                  waterfall is posted. Items leave this queue once their settlement is posted or the
                  payment is voided.
                </p>
              </div>
            </div>

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
                            <TableRow key={item.paymentId}>
                              <TableCell className="font-medium">
                                {item.noteTitle ?? item.noteId}
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
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2"
                                      onClick={() => handleViewDocument(item.evidenceFiles![0].s3Key)}
                                      disabled={viewDocumentPending}
                                    >
                                      View proof ({item.evidenceFiles.length})
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2"
                                      onClick={() =>
                                        handleDownloadDocument(
                                          item.evidenceFiles![0].s3Key,
                                          item.evidenceFiles![0].fileName || "proof-file"
                                        )
                                      }
                                      disabled={viewDocumentPending}
                                    >
                                      Download
                                    </Button>
                                  </div>
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
                                <Badge variant={STATUS_VARIANT[item.status] ?? "secondary"}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                                    ACTION_COPY[item.actionNeeded]?.tone ?? "border-border bg-muted text-foreground"
                                  }`}
                                >
                                  {ACTION_COPY[item.actionNeeded]?.label ?? item.actionNeeded}
                                </span>
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
