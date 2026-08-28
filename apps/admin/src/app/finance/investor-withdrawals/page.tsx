"use client";

import { StatusBadge } from "@cashsouk/ui";

import Link from "next/link";
import { formatAuditDate } from "@/components/audit/audit-presentation";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { WithdrawalStatus } from "@cashsouk/types";
import { formatWithdrawalReference } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequirePermission } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import { useInvestorWithdrawals } from "@/notes/hooks/use-notes";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  LETTER_GENERATED: "Letter generated",
  SUBMITTED_TO_TRUSTEE: "Submitted to trustee",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function maskAccount(accountNumber: string | undefined) {
  if (!accountNumber) return "—";
  if (accountNumber.length <= 4) return accountNumber;
  return `•••• ${accountNumber.slice(-4)}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return formatAuditDate(value);
}

export default function InvestorWithdrawalsPage() {
  const { data, isLoading, error, refetch, isFetching } = useInvestorWithdrawals();

  const items = data?.items ?? [];
  const byStatus = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalAmount = items
    .filter((item) => item.status !== "CANCELLED")
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <RequirePermission permission="investor_withdrawals.view">
      <>
        
        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
            <section className="space-y-4">
              <AdminPageHeader
                title="Investor Withdrawals"
                description="Review and process investor withdrawal requests."
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
                  {error instanceof Error ? error.message : "Failed to load investor withdrawals"}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {(["DRAFT", "LETTER_GENERATED", "SUBMITTED_TO_TRUSTEE", "COMPLETED"] as WithdrawalStatus[]).map(
                  (status) => (
                    <Card key={status} className="rounded-2xl p-6 shadow-sm">
                      <CardHeader className="p-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {STATUS_LABEL[status]}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {isLoading ? (
                          <Skeleton className="h-8 w-12" />
                        ) : (
                          <p className="text-2xl font-bold">{byStatus[status] ?? 0}</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                )}
                <Card className="rounded-2xl p-6 shadow-sm">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total amount
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-sm font-semibold">Reference</TableHead>
                        <TableHead className="text-sm font-semibold">Investor</TableHead>
                        <TableHead className="text-right text-sm font-semibold">Amount</TableHead>
                        <TableHead className="text-sm font-semibold">Bank / Account</TableHead>
                        <TableHead className="text-sm font-semibold">Requested</TableHead>
                        <TableHead className="text-sm font-semibold">Status</TableHead>
                        <TableHead className="text-sm font-semibold">Submitted</TableHead>
                        <TableHead className="text-right text-sm font-semibold">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-[15px]">
                      {isLoading ? (
                        Array.from({ length: 4 }).map((_, index) => (
                          <TableRow key={index}>
                            {Array.from({ length: 8 }).map((__, cellIndex) => (
                              <TableCell key={cellIndex}>
                                <Skeleton className="h-5 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                            No investor withdrawal requests yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => {
                          const snapshot = item.beneficiarySnapshot;
                          const accountNumber =
                            typeof snapshot.account_number === "string"
                              ? snapshot.account_number
                              : "";
                          const bankName =
                            typeof snapshot.bank_name === "string" ? snapshot.bank_name : "";
                          return (
                            <TableRow
                              key={item.withdrawalId}
                              className={cn(
                                "odd:bg-muted/40 hover:bg-muted",
                                adminActionRowClass(getAdminStatusToken(item.status))
                              )}
                            >
                              <TableCell className="font-mono text-xs">
                                <Link
                                  href={`/finance/investor-withdrawals/${item.withdrawalId}`}
                                  className="hover:text-primary hover:underline"
                                >
                                  {formatWithdrawalReference({
                                    displayReference: item.displayReference,
                                    id: item.withdrawalId,
                                  })}
                                </Link>
                              </TableCell>
                              <TableCell>{item.investorOrganizationName ?? "—"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                              <TableCell>
                                {bankName ? `${bankName} · ` : ""}
                                {maskAccount(accountNumber)}
                              </TableCell>
                              <TableCell>{formatDate(item.createdAt)}</TableCell>
                              <TableCell>
                                <StatusBadge
                                  label={STATUS_LABEL[item.status] ?? item.status}
                                  status={getAdminStatusToken(item.status)}
                                />
                              </TableCell>
                              <TableCell>
                                {formatDate(item.submittedToTrusteeAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button asChild variant="ghost" size="sm" className="gap-1">
                                  <Link href={`/finance/investor-withdrawals/${item.withdrawalId}`}>
                                    Open
                                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
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
