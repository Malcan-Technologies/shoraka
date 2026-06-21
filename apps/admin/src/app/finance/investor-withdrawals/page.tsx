"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { InvestorWithdrawalListItem, WithdrawalStatus } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { usePermissions } from "@/hooks/use-permissions";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import {
  useGenerateWithdrawalLetter,
  useInvestorWithdrawals,
  useMarkWithdrawalCompleted,
  useMarkWithdrawalSubmitted,
  useUpdateWithdrawalBeneficiary,
} from "@/notes/hooks/use-notes";

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
  return format(new Date(value), "dd MMM yyyy");
}

function WithdrawalActions({
  item,
  canManage,
  onDownload,
  downloadPending,
}: {
  item: InvestorWithdrawalListItem;
  canManage: boolean;
  onDownload: (key: string) => void;
  downloadPending: boolean;
}) {
  const generateLetter = useGenerateWithdrawalLetter();
  const markSubmitted = useMarkWithdrawalSubmitted();
  const markCompleted = useMarkWithdrawalCompleted();
  const updateBeneficiary = useUpdateWithdrawalBeneficiary();
  const [editOpen, setEditOpen] = React.useState(false);
  const snapshot = item.beneficiarySnapshot;
  const [form, setForm] = React.useState({
    accountHolder:
      typeof snapshot.account_holder === "string" ? snapshot.account_holder : "",
    bankName: typeof snapshot.bank_name === "string" ? snapshot.bank_name : "",
    accountNumber:
      typeof snapshot.account_number === "string" ? snapshot.account_number : "",
    remarks:
      typeof snapshot.reference_note === "string"
        ? snapshot.reference_note
        : typeof snapshot.remarks === "string"
          ? snapshot.remarks
          : "",
  });

  // TODO: cancellation/reversal is out of scope; requires a separately designed balance reversal flow with idempotency, audit logging, and clear status handling.

  const pending =
    generateLetter.isPending || markSubmitted.isPending || markCompleted.isPending || downloadPending;

  const actions: Array<{ label: string; onClick: () => void }> = [];

  if (item.status === "DRAFT" && canManage) {
    actions.push({
      label: "Generate letter",
      onClick: () =>
        generateLetter.mutate(item.withdrawalId, {
          onSuccess: () => toast.success("Trustee letter generated"),
          onError: (error) => toast.error(error.message),
        }),
    });
    actions.push({
      label: "Edit beneficiary",
      onClick: () => {
        setForm({
          accountHolder:
            typeof snapshot.account_holder === "string" ? snapshot.account_holder : "",
          bankName: typeof snapshot.bank_name === "string" ? snapshot.bank_name : "",
          accountNumber:
            typeof snapshot.account_number === "string" ? snapshot.account_number : "",
          remarks:
            typeof snapshot.reference_note === "string"
              ? snapshot.reference_note
              : typeof snapshot.remarks === "string"
                ? snapshot.remarks
                : "",
        });
        setEditOpen(true);
      },
    });
  }

  if (item.letterS3Key) {
    actions.push({
      label: "Download letter",
      onClick: () => onDownload(item.letterS3Key!),
    });
  }

  if (item.status === "LETTER_GENERATED" && canManage) {
    actions.push({
      label: "Submit to trustee",
      onClick: () =>
        markSubmitted.mutate(item.withdrawalId, {
          onSuccess: () => toast.success("Marked submitted to trustee"),
          onError: (error) => toast.error(error.message),
        }),
    });
  }

  if (item.status === "SUBMITTED_TO_TRUSTEE" && canManage) {
    actions.push({
      label: "Mark completed",
      onClick: () =>
        markCompleted.mutate(item.withdrawalId, {
          onSuccess: () => toast.success("Withdrawal marked completed"),
          onError: (error) => toast.error(error.message),
        }),
    });
  }

  if (actions.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={pending}>
            <EllipsisVerticalIcon className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => (
            <DropdownMenuItem key={action.label} onClick={action.onClick}>
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-6 pb-4 pt-6">
            <DialogTitle className="text-lg font-semibold">Edit beneficiary</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-6">
            <div className="space-y-2">
              <Label htmlFor={`beneficiary-holder-${item.withdrawalId}`}>Payee / Account holder</Label>
              <Input
                id={`beneficiary-holder-${item.withdrawalId}`}
                value={form.accountHolder}
                className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                onChange={(event) => setForm((prev) => ({ ...prev, accountHolder: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`beneficiary-bank-${item.withdrawalId}`}>Bank name</Label>
              <Input
                id={`beneficiary-bank-${item.withdrawalId}`}
                value={form.bankName}
                className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                onChange={(event) => setForm((prev) => ({ ...prev, bankName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`beneficiary-account-${item.withdrawalId}`}>Account number</Label>
              <Input
                id={`beneficiary-account-${item.withdrawalId}`}
                value={form.accountNumber}
                className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, accountNumber: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`beneficiary-remarks-${item.withdrawalId}`}>Remarks</Label>
              <Input
                id={`beneficiary-remarks-${item.withdrawalId}`}
                value={form.remarks}
                className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={updateBeneficiary.isPending}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
              disabled={updateBeneficiary.isPending}
              onClick={() => {
                updateBeneficiary.mutate(
                  {
                    id: item.withdrawalId,
                    beneficiarySnapshot: {
                      ...snapshot,
                      account_holder: form.accountHolder.trim(),
                      bank_name: form.bankName.trim(),
                      account_number: form.accountNumber.trim(),
                      reference_note: form.remarks.trim(),
                      remarks: form.remarks.trim(),
                    },
                  },
                  {
                    onSuccess: () => {
                      toast.success("Beneficiary details updated");
                      setEditOpen(false);
                    },
                    onError: (error) => {
                      toast.error(error.message);
                    },
                  }
                );
              }}
            >
              {updateBeneficiary.isPending ? "Saving..." : "Save beneficiary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function InvestorWithdrawalsPage() {
  const { can } = usePermissions();
  const canManage = can("investor_withdrawals.manage");
  const { handleViewDocument, viewDocumentPending } = useAdminS3DocumentViewDownload();
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
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Investor Withdrawals</h1>
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
                  <ArrowUpTrayIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Investor withdrawal requests</h2>
                  <p className="text-sm text-muted-foreground">
                    Review and process investor withdrawal requests.
                  </p>
                </div>
              </div>

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
                        <TableHead className="text-sm font-semibold">Letter</TableHead>
                        <TableHead className="text-sm font-semibold">Actions</TableHead>
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
                            <TableRow key={item.withdrawalId} className="odd:bg-muted/40 hover:bg-muted">
                              <TableCell className="font-mono text-xs">
                                {item.withdrawalId.slice(0, 8)}…
                              </TableCell>
                              <TableCell>{item.investorOrganizationName ?? "—"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                              <TableCell>
                                {bankName ? `${bankName} · ` : ""}
                                {maskAccount(accountNumber)}
                              </TableCell>
                              <TableCell>{formatDate(item.createdAt)}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {STATUS_LABEL[item.status] ?? item.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {item.letterS3Key ? (
                                  <DocumentTextIcon className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell>
                                <WithdrawalActions
                                  item={item}
                                  canManage={canManage}
                                  downloadPending={viewDocumentPending}
                                  onDownload={(key) => void handleViewDocument(key)}
                                />
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
