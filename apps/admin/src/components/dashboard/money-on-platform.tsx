"use client";

import Link from "next/link";
import { Card, CardContent, Skeleton } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { useNoteBucketBalances } from "@/notes/hooks/use-notes";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import {
  LEDGER_BUCKET_GROUPS,
  buildLedgerBucketOverview,
  formatLedgerShare,
  ledgerBarWidthPercent,
  type LedgerBucketGroupId,
} from "@/lib/ledger-bucket-display";
import { DashboardSectionHeader } from "./dashboard-section-header";
import {
  LEDGER_GROUP_STROKE_CLASS,
  LEDGER_GROUP_SWATCH_CLASS,
  donutGroupFractions,
  donutSegmentDash,
  formatCompactLedgerAmount,
} from "./money-on-platform-display";

const INCOME_FILL_CLASS =
  LEDGER_BUCKET_GROUPS.find((group) => group.id === "income")?.fillClass ??
  "bg-[hsl(163_88%_40%)] dark:bg-status-success-text";

const GROUP_ITEM_FILLS: Record<LedgerBucketGroupId, string[]> = {
  custody: ["bg-status-submitted-text", "bg-status-submitted-text/55"],
  income: [
    INCOME_FILL_CLASS,
    "bg-[hsl(163_88%_40%/0.65)] dark:bg-status-success-text/65",
    "bg-[hsl(163_88%_40%/0.4)] dark:bg-status-success-text/40",
  ],
  payable: ["bg-status-active-text"],
};

export function MoneyOnPlatform() {
  const { can } = usePermissions();
  const canViewDetails = can("bucket_balances.view");
  const canLoadBuckets = can("dashboard.finance.view") || canViewDetails;
  const { data, isLoading, error } = useNoteBucketBalances({ enabled: canLoadBuckets });
  const overview = buildLedgerBucketOverview(data?.buckets ?? []);
  const creditTotal = data?.totals.creditTotal;
  const debitTotal = data?.totals.debitTotal;
  const netBalance = data?.totals.balance ?? overview.netBalance;
  const segments = donutGroupFractions(overview.groups, overview.heldTotal);
  const itemHeldMax = Math.max(...overview.items.map((item) => Math.max(item.balance, 0)), 0);

  return (
    <section>
      <DashboardSectionHeader
        title="Money on the platform"
        subtitle="Where cash sits across investor, repayment and income pools"
        action={
          <div className="flex items-center gap-4">
            <Link
              href="/help/admin-note-money-flow"
              className="text-ui font-medium text-primary hover:text-accent"
            >
              How money moves →
            </Link>
            {canViewDetails ? (
              <Link href="/finance/buckets" className="text-ui font-medium text-primary hover:text-accent">
                Bucket details →
              </Link>
            ) : null}
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="flex gap-6 p-6">
              <Skeleton className="h-[136px] w-[136px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="space-y-4 p-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6 text-ui text-destructive">
            {error instanceof Error ? error.message : "Unable to load bucket balances"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="flex flex-wrap items-center gap-6 p-6">
              <div className="relative h-[136px] w-[136px] shrink-0">
                <svg viewBox="0 0 136 136" className="h-[136px] w-[136px] -rotate-90" aria-hidden>
                  <circle
                    cx="68"
                    cy="68"
                    r="52"
                    fill="none"
                    className="stroke-muted"
                    strokeWidth="16"
                  />
                  {segments.map((segment) => {
                    if (segment.fraction <= 0) return null;
                    const dash = donutSegmentDash(segment.fraction, segment.offsetFraction);
                    return (
                      <circle
                        key={segment.id}
                        cx="68"
                        cy="68"
                        r="52"
                        fill="none"
                        className={LEDGER_GROUP_STROKE_CLASS[segment.id]}
                        strokeWidth="16"
                        strokeDasharray={dash.dasharray}
                        strokeDashoffset={dash.dashoffset}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="text-meta text-muted-foreground">Net ledger</div>
                  <div className="text-ui font-bold tabular-nums tracking-tight">
                    {formatCompactLedgerAmount(netBalance)}
                  </div>
                </div>
              </div>

              <div className="min-w-[180px] flex-1">
                <div className="text-meta text-muted-foreground">Net ledger balance</div>
                <div
                  className={cn(
                    "mt-0.5 text-2xl font-bold tabular-nums tracking-tight",
                    netBalance < 0 && "text-status-rejected-text"
                  )}
                >
                  {formatCurrency(netBalance)}
                </div>
                <div className="mt-3.5 flex flex-col gap-2">
                  {overview.groups.map((group) => (
                    <div key={group.id} className="flex items-center gap-2 text-ui">
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", LEDGER_GROUP_SWATCH_CLASS[group.id])}
                        aria-hidden
                      />
                      <span className="flex-1 text-foreground">{group.label}</span>
                      <span className="font-semibold tabular-nums">
                        {formatLedgerShare(group.held, overview.heldTotal)}
                      </span>
                    </div>
                  ))}
                </div>
                {creditTotal != null && debitTotal != null ? (
                  <div className="mt-4 flex gap-6 border-t border-border pt-3">
                    <div>
                      <div className="text-meta text-muted-foreground">Credits</div>
                      <div className="text-ui font-medium tabular-nums">{formatCurrency(creditTotal)}</div>
                    </div>
                    <div>
                      <div className="text-meta text-muted-foreground">Debits</div>
                      <div className="text-ui font-medium tabular-nums">{formatCurrency(debitTotal)}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-ui font-medium">Six buckets</p>
                <p className="text-meta text-muted-foreground">share of cash held</p>
              </div>
              <div className="mt-4 flex flex-col gap-3.5">
                {overview.groups.flatMap((group) =>
                  group.items.map((item, index) => {
                    const held = Math.max(item.balance, 0);
                    const fillClass = GROUP_ITEM_FILLS[group.id][index] ?? group.fillClass;
                    return (
                      <div key={item.accountCode}>
                        <div className="flex items-baseline gap-2 text-ui">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", fillClass)} aria-hidden />
                          <span className="min-w-0 flex-1 text-foreground">{item.meta.shortLabel}</span>
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              item.balance < 0 && "text-status-rejected-text"
                            )}
                          >
                            {formatCurrency(item.balance)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", held > 0 && "min-w-1", fillClass)}
                            style={{ width: `${ledgerBarWidthPercent(held, itemHeldMax)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
