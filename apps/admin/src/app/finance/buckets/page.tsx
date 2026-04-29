"use client";

import { format } from "date-fns";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Badge } from "@/components/ui/badge";
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
import { useNoteBucketBalances } from "@/notes/hooks/use-notes";

const bucketDescriptions: Record<string, string> = {
  INVESTOR_POOL: "Investor funds, disbursements, principal returns, and net profit allocations.",
  REPAYMENT_POOL: "Receipts collected from paymasters or issuers before settlement allocation.",
  OPERATING_ACCOUNT: "Platform fees, service fees, and operating account allocations.",
  TAWIDH_ACCOUNT: "Syariah compensation account for approved Ta'widh late charges.",
  GHARAMAH_ACCOUNT: "Syariah charity/penalty account for approved Gharamah late charges.",
};

function formatDateTime(value: string | null) {
  return value ? format(new Date(value), "dd MMM yyyy, h:mm a") : "No entries";
}

export default function BucketBalancesPage() {
  const { data, isLoading, error } = useNoteBucketBalances();
  const buckets = data?.buckets ?? [];

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
                  View ledger-derived balances across Investor Pool, Repayment Pool, Operating Account, Ta'widh,
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

            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bucket</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Debits</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Entries</TableHead>
                    <TableHead>Last Movement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Loading bucket balances...
                      </TableCell>
                    </TableRow>
                  ) : buckets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No ledger buckets found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    buckets.map((bucket) => (
                      <TableRow key={bucket.accountCode}>
                        <TableCell>
                          <div className="font-medium">{bucket.accountName}</div>
                          <div className="text-xs text-muted-foreground">{bucket.accountCode}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(bucket.creditTotal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(bucket.debitTotal)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(bucket.balance)}</TableCell>
                        <TableCell className="text-right">{bucket.entryCount}</TableCell>
                        <TableCell>{formatDateTime(bucket.lastPostedAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

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
