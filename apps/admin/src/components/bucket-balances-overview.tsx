"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BanknotesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { NoteLedgerAccountType } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNoteBucketBalances } from "@/notes/hooks/use-notes";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import {
  LEDGER_BUCKET_GROUPS,
  buildLedgerBucketOverview,
  formatLedgerShare,
  ledgerBarWidthPercent,
  type LedgerBucketGroupId,
  type LedgerBucketOverviewGroup,
  type LedgerBucketOverviewItem,
} from "@/lib/ledger-bucket-display";

const INCOME_FILL_CLASS =
  LEDGER_BUCKET_GROUPS.find((group) => group.id === "income")?.fillClass ??
  "bg-[hsl(163_88%_40%)] dark:bg-status-success-text";

function bucketByCode(items: LedgerBucketOverviewItem[], code: NoteLedgerAccountType) {
  return items.find((item) => item.accountCode === code);
}

function FlowConnector({ className }: { className?: string }) {
  return (
    <div
      className={cn("hidden items-center justify-center sm:flex", className)}
      aria-hidden
    >
      <div className="h-px w-3 bg-border" />
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

function SettlementReturnArrow({ layout }: { layout: "mobile" | "desktop" }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-status-submitted-text",
        layout === "mobile" ? "gap-2 py-1" : "flex-col gap-0.5 py-1"
      )}
      role="img"
      aria-label="Settlement returns investor principal and profit from the Repayment Pool to the Investor Pool"
    >
      {layout === "mobile" ? (
        <ChevronUpIcon className="h-4 w-4" />
      ) : (
        <>
          <ChevronUpIcon className="h-4 w-4" />
          <div className="h-3 w-px bg-status-submitted-text/50" />
        </>
      )}
      <span className="text-meta font-medium text-muted-foreground">
        {layout === "mobile" ? "Principal & profit to Investor Pool" : "Principal & profit"}
      </span>
      {layout === "desktop" ? <div className="h-3 w-px bg-status-submitted-text/50" /> : null}
    </div>
  );
}

function EventChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-dashed bg-muted/40 px-3 py-2 text-center sm:min-w-32", className)}>
      <div className="text-meta font-medium text-muted-foreground">{children}</div>
    </div>
  );
}

function PoolNode({
  item,
  fillClass,
  className,
}: {
  item: LedgerBucketOverviewItem | undefined;
  fillClass: string;
  className?: string;
}) {
  if (!item) return null;
  return (
    <div className={cn("min-w-0 rounded-xl border bg-card px-3 py-2.5 shadow-sm sm:min-w-44", className)}>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", fillClass)} aria-hidden />
        <div className="truncate text-ui font-medium">{item.meta.shortLabel}</div>
      </div>
      <div
        className={cn(
          "mt-1 truncate text-body font-semibold tabular-nums tracking-tight",
          item.balance < 0 && "text-destructive"
        )}
        title={formatCurrency(item.balance)}
      >
        {formatCurrency(item.balance)}
      </div>
      <div className="mt-0.5 truncate text-meta text-muted-foreground">{item.meta.hint}</div>
    </div>
  );
}

function AllocationChip({ item, fillClass }: { item: LedgerBucketOverviewItem; fillClass: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-card px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", fillClass)} aria-hidden />
        <span className="truncate text-meta text-muted-foreground">{item.meta.shortLabel}</span>
      </div>
      <span
        className={cn(
          "shrink-0 text-meta font-medium tabular-nums text-foreground",
          item.balance < 0 && "text-destructive"
        )}
      >
        {formatCurrency(item.balance)}
      </span>
    </div>
  );
}

function CompositionBar({ groups, heldTotal }: { groups: LedgerBucketOverviewGroup[]; heldTotal: number }) {
  if (heldTotal <= 0) {
    return (
      <div
        className="h-2.5 w-full rounded-full border border-dashed border-border bg-muted/40"
        role="img"
        aria-label="No positive bucket balances to chart"
      />
    );
  }

  return (
    <div
      className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-border p-px"
      role="img"
      aria-label={`Balance mix: ${groups
        .map((group) => `${group.label} ${formatCurrency(group.held)}`)
        .join(", ")}`}
    >
      {groups.map((group) => {
        if (group.held <= 0) return null;
        return (
          <Tooltip key={group.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "min-w-1 cursor-default rounded-sm first:rounded-l-[calc(var(--radius)-2px)] last:rounded-r-[calc(var(--radius)-2px)]",
                  group.fillClass
                )}
                style={{ width: `${(group.held / heldTotal) * 100}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {group.label}: {formatCurrency(group.held)} ({formatLedgerShare(group.held, heldTotal)})
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

const GROUP_ITEM_FILLS: Record<LedgerBucketGroupId, string[]> = {
  custody: ["bg-status-submitted-text", "bg-status-submitted-text/55"],
  income: [
    INCOME_FILL_CLASS,
    "bg-[hsl(163_88%_40%/0.65)] dark:bg-status-success-text/65",
    "bg-[hsl(163_88%_40%/0.4)] dark:bg-status-success-text/40",
  ],
  payable: ["bg-status-active-text"],
};

function GroupColumn({ group, heldTotal }: { group: LedgerBucketOverviewGroup; heldTotal: number }) {
  const itemFills = GROUP_ITEM_FILLS[group.id];

  return (
    <Collapsible
      defaultOpen={false}
      className={cn("min-w-0 rounded-xl border", group.surfaceClass)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full flex-col gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-ui font-medium">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", group.fillClass)} aria-hidden />
                <span className="truncate">{group.label}</span>
              </div>
              <p className="mt-1 text-meta text-muted-foreground">{group.hint}</p>
            </div>
            <ChevronDownIcon
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <div
              className={cn(
                "text-2xl font-bold tabular-nums tracking-tight",
                group.balance < 0 && "text-destructive"
              )}
            >
              {formatCurrency(group.balance)}
            </div>
            <div className="text-meta text-muted-foreground">
              {formatLedgerShare(group.held, heldTotal)} of cash
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-3 px-4 pb-4">
          {group.items.map((item, index) => {
            const held = Math.max(item.balance, 0);
            const fillClass = itemFills[index] ?? group.fillClass;
            return (
              <li key={item.accountCode} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", fillClass)} aria-hidden />
                    <span className="truncate text-ui" title={item.accountName}>
                      {item.meta.shortLabel}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "shrink-0 text-ui font-semibold tabular-nums",
                      item.balance < 0 && "text-destructive"
                    )}
                    title={formatCurrency(item.balance)}
                  >
                    {formatCurrency(item.balance)}
                  </div>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-background/70">
                  <div
                    className={cn("h-full rounded-full", held > 0 && "min-w-1", fillClass)}
                    style={{ width: `${ledgerBarWidthPercent(held, group.itemHeldTotal)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-meta text-muted-foreground">
                  <span className="truncate">
                    In {formatCurrency(item.creditTotal)} · Out {formatCurrency(item.debitTotal)}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatLedgerShare(held, group.itemHeldTotal)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AllocationGrid({ items }: { items: LedgerBucketOverviewItem[] }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2">
      {items.map((item) => (
        <AllocationChip
          key={item.accountCode}
          item={item}
          fillClass={item.meta.group === "payable" ? "bg-status-active-text" : INCOME_FILL_CLASS}
        />
      ))}
    </div>
  );
}

function MoneyFlow({ items }: { items: LedgerBucketOverviewItem[] }) {
  const investorPool = bucketByCode(items, NoteLedgerAccountType.INVESTOR_POOL);
  const repaymentPool = bucketByCode(items, NoteLedgerAccountType.REPAYMENT_POOL);
  const allocations = [
    bucketByCode(items, NoteLedgerAccountType.OPERATING_ACCOUNT),
    bucketByCode(items, NoteLedgerAccountType.TAWIDH_ACCOUNT),
    bucketByCode(items, NoteLedgerAccountType.GHARAMAH_ACCOUNT),
    bucketByCode(items, NoteLedgerAccountType.ISSUER_PAYABLE),
  ].filter((item): item is LedgerBucketOverviewItem => Boolean(item));

  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
      <div>
        <h3 className="text-ui font-medium">How money moves</h3>
        <p className="mt-1 text-meta text-muted-foreground">
          Settlement splits the Repayment Pool into investor returns, fees, Syariah accounts, and issuer residual.
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:hidden">
        <EventChip>Deposits</EventChip>
        <div className="flex justify-center" aria-hidden>
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <PoolNode item={investorPool} fillClass="bg-status-submitted-text" />
        <div className="flex justify-center" aria-hidden>
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <EventChip>Notes & withdrawals</EventChip>
        <SettlementReturnArrow layout="mobile" />
        <EventChip>Receipts</EventChip>
        <div className="flex justify-center" aria-hidden>
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <PoolNode item={repaymentPool} fillClass="bg-status-submitted-text" />
        <div className="flex justify-center" aria-hidden>
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <AllocationGrid items={allocations} />
      </div>

      <div className="hidden sm:grid sm:grid-cols-[auto_auto_minmax(12rem,14rem)_auto_minmax(0,1fr)] sm:grid-rows-2 sm:items-center sm:gap-x-1">
        <EventChip>Deposits</EventChip>
        <FlowConnector />
        <div className="flex flex-col sm:col-start-3 sm:row-span-2 sm:row-start-1">
          <PoolNode item={investorPool} fillClass="bg-status-submitted-text" className="w-full" />
          <SettlementReturnArrow layout="desktop" />
          <PoolNode item={repaymentPool} fillClass="bg-status-submitted-text" className="w-full" />
        </div>
        <FlowConnector className="sm:col-start-4 sm:row-start-1" />
        <EventChip className="sm:col-start-5 sm:row-start-1">Notes & withdrawals</EventChip>

        <EventChip className="sm:col-start-1 sm:row-start-2">Receipts</EventChip>
        <FlowConnector className="sm:col-start-2 sm:row-start-2" />
        <FlowConnector className="sm:col-start-4 sm:row-start-2" />
        <div className="sm:col-start-5 sm:row-start-2">
          <AllocationGrid items={allocations} />
        </div>
      </div>
    </div>
  );
}

export function BucketBalancesOverview() {
  const { can } = usePermissions();
  const canViewDetails = can("bucket_balances.view");
  const { data, isLoading, error } = useNoteBucketBalances();
  const overview = buildLedgerBucketOverview(data?.buckets ?? []);
  const creditTotal = data?.totals.creditTotal ?? 0;
  const debitTotal = data?.totals.debitTotal ?? 0;
  const netBalance = data?.totals.balance ?? overview.netBalance;

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <BanknotesIcon className="h-5 w-5 text-muted-foreground" />
            Bucket Balances
          </CardTitle>
          {canViewDetails && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/finance/buckets">
                View details
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-xl border border-destructive/30 p-4 text-ui text-destructive">
            {error instanceof Error ? error.message : "Unable to load bucket balances"}
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-meta text-muted-foreground">Net ledger balance</div>
                  <div
                    className={cn(
                      "mt-1 text-3xl font-bold tabular-nums tracking-tight",
                      netBalance < 0 && "text-destructive"
                    )}
                  >
                    {formatCurrency(netBalance)}
                  </div>
                </div>
                <dl className="flex gap-6">
                  <div>
                    <dt className="text-meta text-muted-foreground">Credits</dt>
                    <dd className="mt-0.5 text-ui font-medium tabular-nums">{formatCurrency(creditTotal)}</dd>
                  </div>
                  <div>
                    <dt className="text-meta text-muted-foreground">Debits</dt>
                    <dd className="mt-0.5 text-ui font-medium tabular-nums">{formatCurrency(debitTotal)}</dd>
                  </div>
                </dl>
              </div>

              <CompositionBar groups={overview.groups} heldTotal={overview.heldTotal} />

              <div className="grid gap-3 md:grid-cols-3 md:items-start">
                {overview.groups.map((group) => (
                  <GroupColumn key={group.id} group={group} heldTotal={overview.heldTotal} />
                ))}
              </div>

              <MoneyFlow items={overview.items} />
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
