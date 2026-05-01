"use client";

import * as React from "react";
import { format } from "date-fns";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Skeleton } from "@cashsouk/ui";
import type { NoteLedgerBucketBalance } from "@cashsouk/types";
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
import { useNoteBucketActivity, useNoteBucketBalances } from "@/notes/hooks/use-notes";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";

const bucketDescriptions: Record<string, string> = {
  INVESTOR_POOL: "Investor funds, disbursements, principal returns, and net profit allocations.",
  REPAYMENT_POOL: "Receipts collected from paymasters or issuers before settlement allocation.",
  OPERATING_ACCOUNT: "Platform fees, service fees, and operating account allocations.",
  TAWIDH_ACCOUNT: "Syariah compensation account for approved Ta'widh late charges.",
  GHARAMAH_ACCOUNT: "Syariah charity/penalty account for approved Gharamah late charges.",
};

const ACTIVITY_PAGE_SIZE = 20;

function formatDateTime(value: string | null) {
  return value ? format(new Date(value), "dd MMM yyyy, h:mm a") : "No entries";
}

function ActivityTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell><Skeleton className="h-5 w-32" /></TableCell>
          <TableCell><Skeleton className="h-5 w-40" /></TableCell>
          <TableCell><Skeleton className="h-5 w-56" /></TableCell>
          <TableCell><Skeleton className="ml-auto h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="ml-auto h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-32" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function BucketActivityLog({
  bucket,
  page,
  onPageChange,
}: {
  bucket: NoteLedgerBucketBalance | null;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { data, isLoading, error } = useNoteBucketActivity(bucket?.accountCode ?? null, page, ACTIVITY_PAGE_SIZE);
  const entries = data?.entries ?? [];
  const pagination = data?.pagination;
  const startIndex = pagination && pagination.totalCount > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endIndex = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.totalCount) : 0;

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{bucket?.accountName ?? "Bucket"} Activity Log</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Ledger movements posted to the selected bucket, ordered by latest transaction first.
          </p>
        </div>
        {bucket ? <Badge variant="outline">{bucket.currency}</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {bucket ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">Credits</div>
              <div className="mt-1 font-semibold">{formatCurrency(data?.bucket.creditTotal ?? bucket.creditTotal)}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">Debits</div>
              <div className="mt-1 font-semibold">{formatCurrency(data?.bucket.debitTotal ?? bucket.debitTotal)}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="mt-1 font-semibold">{formatCurrency(data?.bucket.balance ?? bucket.balance)}</div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            Error loading bucket activity: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[16%]">Posted</TableHead>
                <TableHead className="w-[18%]">Note</TableHead>
                <TableHead className="w-[26%]">Description</TableHead>
                <TableHead className="w-[13%] text-right">Debit</TableHead>
                <TableHead className="w-[13%] text-right">Credit</TableHead>
                <TableHead className="w-[14%]">Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <ActivityTableSkeleton />
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No transactions posted to this bucket yet.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="truncate text-xs text-muted-foreground">
                      {formatDateTime(entry.postedAt)}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <div className="truncate font-medium">{entry.noteReference ?? "-"}</div>
                      <div className="truncate text-xs text-muted-foreground">{entry.noteTitle ?? "No linked note"}</div>
                    </TableCell>
                    <TableCell className="truncate text-sm">{entry.description}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {entry.direction === "DEBIT" ? formatCurrency(entry.amount) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {entry.direction === "CREDIT" ? formatCurrency(entry.amount) : "-"}
                    </TableCell>
                    <TableCell className="truncate font-mono text-[11px] text-muted-foreground">
                      {entry.idempotencyKey}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {pagination ? (
            <TablePagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={pagination.totalCount}
              onPageChange={onPageChange}
            />
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          Generated at {formatDateTime(data?.generatedAt ?? null)}.
        </div>
      </CardContent>
    </Card>
  );
}

export default function BucketBalancesPage() {
  const { data, isLoading, error } = useNoteBucketBalances();
  const buckets = React.useMemo(() => data?.buckets ?? [], [data?.buckets]);
  const [selectedBucketCode, setSelectedBucketCode] = React.useState<string | null>(null);
  const [activityPage, setActivityPage] = React.useState(1);
  const activeBucket = buckets.find((bucket) => bucket.accountCode === selectedBucketCode) ?? buckets[0] ?? null;

  React.useEffect(() => {
    if (!selectedBucketCode && buckets[0]) {
      setSelectedBucketCode(buckets[0].accountCode);
    }
  }, [buckets, selectedBucketCode]);

  const handleSelectBucket = (accountCode: string) => {
    setSelectedBucketCode(accountCode);
    setActivityPage(1);
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Bucket Balances</h1>
        <div className="ml-auto">
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
                <h2 className="text-lg font-semibold">Platform Money Buckets</h2>
                <p className="text-sm text-muted-foreground">
                  View ledger-derived balances across Investor Pool, Repayment Pool, Operating Account, Ta&apos;widh,
                  and Gharamah.
                </p>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                Error loading bucket balances: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Total Credits</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {formatCurrency(data?.totals.creditTotal ?? 0)}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Total Debits</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {formatCurrency(data?.totals.debitTotal ?? 0)}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Net Ledger Balance</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {formatCurrency(data?.totals.balance ?? 0)}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <Card key={index} className="h-44 animate-pulse rounded-2xl bg-muted/40" />
                  ))
                : buckets.map((bucket) => (
                    <Card key={bucket.accountCode} className="rounded-2xl">
                      <CardHeader className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{bucket.accountName}</CardTitle>
                          <Badge variant="outline">{bucket.currency}</Badge>
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {bucketDescriptions[bucket.accountCode] ?? "Platform ledger bucket."}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Balance</div>
                          <div className="mt-1 text-2xl font-semibold">{formatCurrency(bucket.balance)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground">Credits</div>
                            <div className="font-medium">{formatCurrency(bucket.creditTotal)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Debits</div>
                            <div className="font-medium">{formatCurrency(bucket.debitTotal)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
            </div>

            <section className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">Bucket Activity Log</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Switch buckets to review posted ledger transactions. Each page shows 20 rows.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {buckets.map((bucket) => {
                  const isActive = activeBucket?.accountCode === bucket.accountCode;
                  return (
                    <Button
                      key={bucket.accountCode}
                      type="button"
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => handleSelectBucket(bucket.accountCode)}
                    >
                      {bucket.accountName}
                      <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-xs">
                        {bucket.entryCount}
                      </span>
                    </Button>
                  );
                })}
              </div>

              <BucketActivityLog bucket={activeBucket} page={activityPage} onPageChange={setActivityPage} />
            </section>

            <p className="text-xs text-muted-foreground">
              Balances are calculated from posted note ledger entries as credits minus debits. Generated at{" "}
              {formatDateTime(data?.generatedAt ?? null)}.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
