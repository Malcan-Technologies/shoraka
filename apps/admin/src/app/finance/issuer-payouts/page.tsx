"use client";

import * as React from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Skeleton } from "@cashsouk/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePendingIssuerPayouts } from "@/notes/hooks/use-notes";
import { RequirePermission } from "@/components/require-permission";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING_SETTLEMENT_TRUSTEE_LETTER: "secondary",
  LETTER_GENERATED: "outline",
  SUBMITTED_TO_TRUSTEE: "default",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_SETTLEMENT_TRUSTEE_LETTER: "Pending Settlement Trustee Letter",
  LETTER_GENERATED: "Letter generated",
  SUBMITTED_TO_TRUSTEE: "Submitted to trustee",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const TYPE_LABEL: Record<string, string> = {
  ISSUER_DISBURSEMENT: "Disbursement",
  ISSUER_RESIDUAL_RETURN: "Residual refund",
};

const TYPE_TONE: Record<string, string> = {
  ISSUER_DISBURSEMENT: "border-sky-300 bg-sky-50 text-sky-950",
  ISSUER_RESIDUAL_RETURN: "border-amber-300 bg-amber-50 text-amber-950",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy");
}

function formatAge(value: string | null) {
  if (!value) return "—";
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export default function PendingIssuerPayoutsPage() {
  const { data, isLoading, error, refetch, isFetching } = usePendingIssuerPayouts();
  const items = data?.items ?? [];

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const byStatus = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const byType = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.withdrawalType] = (acc[item.withdrawalType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <RequirePermission permission="disbursements.view">
      <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Issuer Payouts</h1>
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
                <h2 className="text-lg font-semibold">Issuer payouts in flight</h2>
                <p className="text-sm text-muted-foreground">
                  All payments owed to issuers, both initial disbursements (after funding close) and
                  residual refunds (after settlement). Progress each item through Draft → Letter
                  Generated → Submitted to Trustee → Disbursed from the note&apos;s settlement panel.
                </p>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load issuer payouts"}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Open payouts</CardTitle>
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
                  <CardTitle className="text-sm text-muted-foreground">Disbursements</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading
                    ? <Skeleton className="h-8 w-12" />
                    : (byType.ISSUER_DISBURSEMENT ?? 0)}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Residual refunds</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading
                    ? <Skeleton className="h-8 w-12" />
                    : (byType.ISSUER_RESIDUAL_RETURN ?? 0)}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">With trustee</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading
                    ? <Skeleton className="h-8 w-12" />
                    : (byStatus.SUBMITTED_TO_TRUSTEE ?? 0)}
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Note</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Issuer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Letter generated</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 4 }).map((_, idx) => (
                          <TableRow key={idx}>
                            {Array.from({ length: 9 }).map((__, jdx) => (
                              <TableCell key={jdx}>
                                <Skeleton className="h-5 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : items.length === 0
                        ? (
                            <TableRow>
                              <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                                No issuer payouts awaiting disbursement.
                              </TableCell>
                            </TableRow>
                          )
                        : items.map((item) => (
                            <TableRow key={item.withdrawalId}>
                              <TableCell className="font-medium">
                                {item.noteTitle ?? item.noteId}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                                    TYPE_TONE[item.withdrawalType] ?? "border-border bg-muted text-foreground"
                                  }`}
                                >
                                  {TYPE_LABEL[item.withdrawalType] ?? item.withdrawalType}
                                </span>
                              </TableCell>
                              <TableCell>{item.issuerOrganizationName ?? "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(item.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={STATUS_VARIANT[item.status] ?? "secondary"}>
                                  {STATUS_LABEL[item.status] ?? item.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(item.generatedAt)}</TableCell>
                              <TableCell>{formatDate(item.submittedToTrusteeAt)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatAge(item.createdAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button asChild variant="ghost" size="sm" className="gap-1">
                                  <Link href={`/notes/${item.noteId}`}>
                                    {item.rowSource === "SETTLEMENT_RESIDUAL" ? "View Settlement" : "Open"}
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
