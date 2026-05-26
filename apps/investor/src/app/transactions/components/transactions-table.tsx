"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@cashsouk/ui";
import { FunnelIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionContext, TransactionType } from "./transactions.types";
import { TRANSACTION_TYPE_FILTER_OPTIONS } from "./transactions.types";
import {
  formatTransactionDateTime,
  getTransactionAmountToneClassName,
  splitBalanceAmount,
  splitSignedTransactionAmount,
} from "./transaction-utils";

const DESKTOP_TABLE =
  "hidden lg:grid lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto] lg:gap-x-6";

const DESKTOP_ROW = "col-span-full grid grid-cols-subgrid [grid-column:1/-1]";

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

function MoneyTableCell({
  prefix,
  digits,
  className,
  toneClassName,
}: {
  prefix: string;
  digits: string;
  className?: string;
  toneClassName?: string;
}) {
  return (
    <TableCell className={cn("font-medium tabular-nums", className)}>
      <div className={cn("flex w-full min-w-0 items-baseline", toneClassName)}>
        <span className="shrink-0">{prefix}</span>
        <span className="ml-auto text-right">{digits}</span>
      </div>
    </TableCell>
  );
}

function MoneyHeaderCell({ label }: { label: string }) {
  return (
    <TableCell>
      <div className="flex w-full min-w-0 items-baseline">
        <span className="shrink-0">{label}</span>
      </div>
    </TableCell>
  );
}

function TransactionContextSubtitle({ context }: { context: TransactionContext }) {
  if (context.kind === "empty") {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  if (context.kind === "text") {
    return <p className="text-sm text-muted-foreground">{context.text}</p>;
  }

  return (
    <p className="text-sm text-muted-foreground">
      {context.prefix ? <span>{context.prefix}</span> : null}
      <Link
        href={`/investments/${context.noteId}`}
        className="hover:text-primary hover:underline"
      >
        {context.noteReferenceDisplay}
      </Link>
    </p>
  );
}

export interface TransactionFilters {
  type: TransactionType | "all";
  timeRange: "all" | "7d" | "30d" | "90d";
}

interface TransactionsTableProps {
  transactions: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  onPageChange: (page: number) => void;
}

function FilterButton({
  label,
  activeCount,
  children,
}: {
  label: string;
  activeCount: number;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 rounded-xl">
          <FunnelIcon className="h-4 w-4" />
          {label}
          {activeCount > 0 ? (
            <Badge
              variant="secondary"
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs text-primary-foreground"
            >
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DesktopTransactionRow({ tx }: { tx: Transaction }) {
  const amountToneClassName = getTransactionAmountToneClassName(tx.type);

  return (
    <div className={cn(DESKTOP_ROW, "border-b border-border py-4 last:border-b-0")}>
      <TableCell className="min-w-0 pl-6">
        <p className="font-medium">{tx.type}</p>
        <TransactionContextSubtitle context={tx.context} />
      </TableCell>
      <MoneyTableCell
        {...splitSignedTransactionAmount(tx.type, tx.amount)}
        toneClassName={amountToneClassName}
      />
      <MoneyTableCell {...splitBalanceAmount(tx.balance)} />
      <TableCell className="pr-6 text-right text-sm tabular-nums text-muted-foreground whitespace-nowrap">
        {formatTransactionDateTime(tx.postedAt)}
      </TableCell>
    </div>
  );
}

function MobileTransactionRow({ tx }: { tx: Transaction }) {
  const amount = splitSignedTransactionAmount(tx.type, tx.amount);
  const balance = splitBalanceAmount(tx.balance);
  const amountToneClassName = getTransactionAmountToneClassName(tx.type);

  return (
    <div className="space-y-2 px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{tx.type}</p>
          <TransactionContextSubtitle context={tx.context} />
        </div>
        <div className={cn("shrink-0 font-medium tabular-nums", amountToneClassName)}>
          <span>{amount.prefix}</span>
          <span>{amount.digits}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {balance.prefix}
          {balance.digits}
        </span>
        <span className="whitespace-nowrap">{formatTransactionDateTime(tx.postedAt)}</span>
      </div>
    </div>
  );
}

export function TransactionsTable({
  transactions,
  totalCount,
  page,
  pageSize,
  filters,
  onFiltersChange,
  onPageChange,
}: TransactionsTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const typeActive = filters.type !== "all" ? 1 : 0;
  const timeActive = filters.timeRange !== "all" ? 1 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Transactions</h2>
          <Badge
            variant="secondary"
            className="rounded-full bg-muted text-muted-foreground font-normal hover:bg-muted"
          >
            {totalCount}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton label="Transaction type" activeCount={typeActive}>
            <DropdownMenuLabel>Transaction type</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.type}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, type: value as TransactionFilters["type"] })
              }
            >
              <DropdownMenuRadioItem value="all">All types</DropdownMenuRadioItem>
              {TRANSACTION_TYPE_FILTER_OPTIONS.map((type) => (
                <DropdownMenuRadioItem key={type} value={type}>
                  {type}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </FilterButton>

          <FilterButton label="Time" activeCount={timeActive}>
            <DropdownMenuLabel>Time</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.timeRange}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, timeRange: value as TransactionFilters["timeRange"] })
              }
            >
              <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="7d">Last 7 days</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="30d">Last 30 days</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="90d">Last 90 days</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </FilterButton>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className={cn(DESKTOP_TABLE, "divide-y divide-border")}>
          <div
            className={cn(
              DESKTOP_ROW,
              "border-b border-border bg-muted/30 py-3 text-sm font-medium text-muted-foreground"
            )}
          >
            <TableCell className="min-w-0 pl-6">Transaction</TableCell>
            <MoneyHeaderCell label="Amount" />
            <MoneyHeaderCell label="Balance" />
            <TableCell className="pr-6 whitespace-nowrap">Time</TableCell>
          </div>

          {transactions.length > 0 ? (
            transactions.map((tx) => <DesktopTransactionRow key={tx.id} tx={tx} />)
          ) : (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No transactions match your current filters.
            </div>
          )}
        </div>

        <div className="divide-y divide-border lg:hidden">
          {transactions.length > 0 ? (
            transactions.map((tx) => <MobileTransactionRow key={tx.id} tx={tx} />)
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No transactions match your current filters.
            </div>
          )}
        </div>

        {totalCount > 0 ? (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {start}-{end} of {totalCount}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
