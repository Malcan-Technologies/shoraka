"use client";

import * as React from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Skeleton } from "@cashsouk/ui";
import type { PendingServiceFeeTrusteeLetterItem } from "@cashsouk/types";
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
import { usePendingServiceFeeTrusteeLetters } from "@/notes/hooks/use-notes";
import { RequirePermission } from "@/components/require-permission";

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy, h:mm a");
}

function formatAge(value: string | null) {
  if (!value) return "—";
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

function formatTrusteeInstructionStatus(item: PendingServiceFeeTrusteeLetterItem) {
  const st = item.trusteeInstructionStatus;
  if (st === "PENDING_LETTER") return "Awaiting PDF";
  if (st === "LETTER_GENERATED") return "Letter generated";
  if (st === "SUBMITTED_TO_TRUSTEE") return "Submitted to trustee";
  if (st === "COMPLETED") return "Complete";
  return "Awaiting PDF";
}

export default function ServiceFeeTrusteeLettersPage() {
  const { data, isLoading, error, refetch, isFetching } = usePendingServiceFeeTrusteeLetters();
  const items = data?.items ?? [];

  const totalFee = items.reduce((sum, item) => sum + item.serviceFeeAmount, 0);
  const distinctNotes = new Set(items.map((item) => item.noteId)).size;

  return (
    <RequirePermission permission="service_fee.view">
      <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Service Fee Instructions</h1>
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
                <ArrowsRightLeftIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Trustee instructions — service fee (pools)</h2>
                <p className="text-sm text-muted-foreground">
                  Posted settlements with a platform service fee stay here until the trustee
                  instruction is marked complete (PDF, submitted, and closed out). Use section 3 on
                  each note&apos;s settlement panel to run the workflow.
                </p>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load pending instructions"}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">
                    Pending instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : items.length}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Total service fee</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrency(totalFee)}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Notes</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : distinctNotes}
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
                      <TableHead>Settlement</TableHead>
                      <TableHead className="text-right">Service fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Settlement posted</TableHead>
                      <TableHead>Age (since post)</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 4 }).map((_, idx) => (
                          <TableRow key={idx}>
                            {Array.from({ length: 8 }).map((__, jdx) => (
                              <TableCell key={jdx}>
                                <Skeleton className="h-5 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : items.length === 0
                        ? (
                            <TableRow>
                              <TableCell
                                colSpan={8}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No pending service fee trustee work. Every posted settlement with a
                                fee has completed the trustee instruction checklist, or there are no
                                qualifying settlements.
                              </TableCell>
                            </TableRow>
                          )
                        : items.map((item) => (
                            <TableRow key={item.settlementId}>
                              <TableCell className="font-medium">
                                {item.noteTitle ?? item.noteId}
                              </TableCell>
                              <TableCell>{item.issuerOrganizationName ?? "—"}</TableCell>
                              <TableCell>
                                <span className="break-all font-mono text-[11px] text-muted-foreground">
                                  {item.settlementId}
                                </span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(item.serviceFeeAmount)}
                              </TableCell>
                              <TableCell>{formatTrusteeInstructionStatus(item)}</TableCell>
                              <TableCell>{formatDate(item.settlementPostedAt)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatAge(item.settlementPostedAt)}
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
