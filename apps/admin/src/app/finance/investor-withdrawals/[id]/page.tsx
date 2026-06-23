"use client";

import * as React from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { RequirePermission } from "@/components/require-permission";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useAdminWithdrawal,
  useGenerateWithdrawalLetter,
  useMarkWithdrawalCompleted,
  useMarkWithdrawalSubmitted,
} from "@/notes/hooks/use-notes";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  LETTER_GENERATED: "Letter generated",
  SUBMITTED_TO_TRUSTEE: "Submitted to trustee",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy, h:mm a");
}

function fullAccount(accountNumber: string | undefined) {
  if (!accountNumber) return "—";
  return accountNumber;
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}

export default function InvestorWithdrawalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : null;
  const { can } = usePermissions();
  const canManage = can("investor_withdrawals.manage");

  const { data: withdrawal, isLoading, error, refetch, isFetching } = useAdminWithdrawal(id);
  const { handleViewDocument, viewDocumentPending } = useAdminS3DocumentViewDownload();
  const generateLetter = useGenerateWithdrawalLetter();
  const markSubmitted = useMarkWithdrawalSubmitted();
  const markCompleted = useMarkWithdrawalCompleted();

  const snapshot =
    withdrawal && withdrawal.beneficiarySnapshot && typeof withdrawal.beneficiarySnapshot === "object"
      ? withdrawal.beneficiarySnapshot
      : {};

  const canGenerateLetter = Boolean(withdrawal && canManage && withdrawal.status === "DRAFT");
  const canSubmitToTrustee = Boolean(
    withdrawal && canManage && withdrawal.status === "LETTER_GENERATED"
  );
  const canMarkCompleted = Boolean(
    withdrawal && canManage && withdrawal.status === "SUBMITTED_TO_TRUSTEE"
  );
  const canDownloadLetter = Boolean(withdrawal?.letterS3Key);

  const isActionPending =
    generateLetter.isPending ||
    markSubmitted.isPending ||
    markCompleted.isPending ||
    viewDocumentPending;

  return (
    <RequirePermission permission="investor_withdrawals.view">
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Investor Withdrawal</h1>
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
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/finance/investor-withdrawals">
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back
                </Link>
              </Button>
            </div>

            {isLoading ? (
              <DetailSkeleton />
            ) : error || !withdrawal ? (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load investor withdrawal details"}
              </div>
            ) : (
              <>
                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <ArrowUpTrayIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Reference</p>
                        <p className="break-all text-base font-medium text-foreground">{withdrawal.id}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto">
                        {STATUS_LABEL[withdrawal.status] ?? withdrawal.status}
                      </Badge>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="text-xl font-semibold">{formatCurrency(withdrawal.amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Requested</p>
                        <p className="font-medium">{formatDateTime(withdrawal.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Currency</p>
                        <p className="font-medium">{withdrawal.currency}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="space-y-6 lg:col-span-2">
                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Withdrawal Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Reference</p>
                          <p className="break-all text-base font-medium text-foreground">{withdrawal.id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <p>{STATUS_LABEL[withdrawal.status] ?? withdrawal.status}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Amount</p>
                          <p>{formatCurrency(withdrawal.amount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Requested date</p>
                          <p>{formatDateTime(withdrawal.createdAt)}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Investor Details</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Investor account</p>
                          <p>{withdrawal.investorOrganizationId ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Requested by</p>
                          <p>{withdrawal.requestedByUserId}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Submitted by</p>
                          <p>{withdrawal.submittedByUserId ?? "—"}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Beneficiary / Bank Details</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Payee / Account holder</p>
                          <p>
                            {typeof (snapshot as Record<string, unknown>).account_holder === "string"
                              ? ((snapshot as Record<string, unknown>).account_holder as string)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Bank name</p>
                          <p>
                            {typeof (snapshot as Record<string, unknown>).bank_name === "string"
                              ? ((snapshot as Record<string, unknown>).bank_name as string)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Account number</p>
                          <p>
                            {fullAccount(
                              typeof (snapshot as Record<string, unknown>).account_number === "string"
                                ? ((snapshot as Record<string, unknown>).account_number as string)
                                : undefined
                            )}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Trustee Letter</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {withdrawal.letterS3Key ? "Letter generated" : "Letter not generated"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Generated at: {formatDateTime(withdrawal.generatedAt)}
                        </p>
                        {withdrawal.letterS3Key ? (
                          <p className="text-xs text-muted-foreground">
                            This letter was generated previously. Download opens the saved PDF. Regenerate is
                            required to apply newer template changes.
                          </p>
                        ) : null}

                        {canDownloadLetter ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={viewDocumentPending}
                            onClick={() => void handleViewDocument(withdrawal.letterS3Key!)}
                          >
                            Download letter
                          </Button>
                        ) : null}

                        {canGenerateLetter ? (
                          <Button
                            type="button"
                            className="w-full bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                            disabled={isActionPending}
                            onClick={() => {
                              generateLetter.mutate(withdrawal.id, {
                                onSuccess: () => toast.success("Trustee letter generated"),
                                onError: (mutationError) => toast.error(mutationError.message),
                              });
                            }}
                          >
                            Generate letter
                          </Button>
                        ) : null}

                        {canSubmitToTrustee ? (
                          <Button
                            type="button"
                            className="w-full bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                            disabled={isActionPending}
                            onClick={() => {
                              markSubmitted.mutate(withdrawal.id, {
                                onSuccess: () => toast.success("Marked submitted to trustee"),
                                onError: (mutationError) => toast.error(mutationError.message),
                              });
                            }}
                          >
                            Submit to trustee
                          </Button>
                        ) : null}

                        {canMarkCompleted ? (
                          <Button
                            type="button"
                            className="w-full bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                            disabled={isActionPending}
                            onClick={() => {
                              markCompleted.mutate(withdrawal.id, {
                                onSuccess: () => toast.success("Withdrawal marked completed"),
                                onError: (mutationError) => toast.error(mutationError.message),
                              });
                            }}
                          >
                            Mark completed
                          </Button>
                        ) : null}

                        {!canManage ? (
                          <p className="text-xs text-muted-foreground">
                            You have view-only access. Processing actions require manage permission.
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Processing Timeline</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Requested</span>
                          <span>{formatDateTime(withdrawal.createdAt)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Letter generated</span>
                          <span>{formatDateTime(withdrawal.generatedAt)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Submitted to trustee</span>
                          <span>{formatDateTime(withdrawal.submittedToTrusteeAt)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Completed</span>
                          <span>{formatDateTime(withdrawal.completedAt)}</span>
                        </div>
                        {withdrawal.status === "CANCELLED" ? (
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Cancelled</span>
                            <span>Yes</span>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </>
    </RequirePermission>
  );
}
