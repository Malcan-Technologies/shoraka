"use client";

import Link from "next/link";
import { ArrowRightIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import { useNoteBucketBalances } from "@/notes/hooks/use-notes";

const bucketDescriptions: Record<string, string> = {
  INVESTOR_POOL: "Investor funds",
  REPAYMENT_POOL: "Receipts awaiting allocation",
  OPERATING_ACCOUNT: "Platform income",
  TAWIDH_ACCOUNT: "Compensation charges",
  GHARAMAH_ACCOUNT: "Charity/penalty charges",
};

export function BucketBalancesOverview() {
  const { data, isLoading, error } = useNoteBucketBalances();
  const buckets = data?.buckets ?? [];
  const largestBalance = Math.max(...buckets.map((bucket) => Math.abs(bucket.balance)), 1);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <BanknotesIcon className="h-5 w-5 text-muted-foreground" />
              Bucket Balances
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Ledger-derived balances across the five platform money buckets.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/finance/buckets">
              View details
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Unable to load bucket balances"}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-primary/5 p-4">
            <div className="text-xs text-muted-foreground">Net Balance</div>
            <div className="mt-1 text-2xl font-semibold text-primary">
              {formatCurrency(data?.totals.balance ?? 0)}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Total Credits</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatCurrency(data?.totals.creditTotal ?? 0)}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Total Debits</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatCurrency(data?.totals.debitTotal ?? 0)}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {buckets.map((bucket) => {
            const width = `${Math.max(4, (Math.abs(bucket.balance) / largestBalance) * 100)}%`;
            return (
              <div key={bucket.accountCode} className="rounded-xl border bg-card p-4">
                <div
                  className="truncate text-xs font-medium text-muted-foreground"
                  title={bucket.accountName}
                >
                  {bucket.accountName}
                </div>
                <div
                  className="mt-1 truncate text-lg font-semibold"
                  title={formatCurrency(bucket.balance)}
                >
                  {formatCurrency(bucket.balance)}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {bucketDescriptions[bucket.accountCode] ?? bucket.accountCode}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width }} />
                </div>
                <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">Cr {formatCurrency(bucket.creditTotal)}</span>
                  <span className="truncate">Dr {formatCurrency(bucket.debitTotal)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
