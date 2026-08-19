"use client";

import * as React from "react";
import Link from "next/link";
import { getUserPortalStatusToken } from "@cashsouk/config";
import { ListToolbar, ListToolbarFilterTrigger, StatusBadge, type FilterChip } from "@cashsouk/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
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
import {
  TRANSACTION_TYPE_FILTER_LABELS,
  TRANSACTION_TYPE_FILTER_OPTIONS,
} from "./transactions.types";
import {
  formatTransactionDateTime,
  getTransactionAmountToneClassName,
  splitBalanceAmount,
  splitSignedTransactionAmount,
} from "./transaction-utils";

const DESKTOP_TABLE =
  "hidden lg:grid lg:grid-cols-[minmax(0,1fr)_10rem_12rem_12rem_auto] lg:gap-x-6";

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

function TransactionStatusBadge({
  tx,
  showEmpty = true,
}: {
  tx: Transaction;
  showEmpty?: boolean;
}) {
  if (!tx.status) {
    return showEmpty ? <p className="text-sm text-muted-foreground">—</p> : null;
  }
  return (
    <StatusBadge
      label={tx.status.label}
      status={getUserPortalStatusToken(tx.status.tokenStatus)}
    />
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
  unfilteredCount: number;
  page: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  onPageChange: (page: number) => void;
  onReload?: () => void;
  isLoading?: boolean;
  toolbarActions?: React.ReactNode;
  showHeading?: boolean;
}

const TIME_RANGE_LABELS: Record<TransactionFilters["timeRange"], string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

function DesktopTransactionRow({ tx }: { tx: Transaction }) {
  const amountToneClassName = getTransactionAmountToneClassName(tx.direction);

  return (
    <div className={cn(DESKTOP_ROW, "border-b border-border py-4 last:border-b-0")}>
      <TableCell className="min-w-0 pl-6">
        <p className="font-medium">{tx.title}</p>
        <TransactionContextSubtitle context={tx.context} />
      </TableCell>
      <TableCell className="self-center">
        <TransactionStatusBadge tx={tx} />
      </TableCell>
      <MoneyTableCell
        {...splitSignedTransactionAmount(tx.direction, tx.amount)}
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
  const amount = splitSignedTransactionAmount(tx.direction, tx.amount);
  const balance = splitBalanceAmount(tx.balance);
  const amountToneClassName = getTransactionAmountToneClassName(tx.direction);

  return (
    <div className="space-y-2 px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="font-medium">{tx.title}</p>
          <TransactionStatusBadge tx={tx} showEmpty={false} />
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
  unfilteredCount,
  page,
  pageSize,
  searchValue,
  onSearchChange,
  filters,
  onFiltersChange,
  onPageChange,
  onReload,
  isLoading = false,
  toolbarActions,
  showHeading = true,
}: TransactionsTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const typeActive = filters.type !== "all" ? 1 : 0;
  const timeActive = filters.timeRange !== "all" ? 1 : 0;
  const hasFilters =
    typeActive + timeActive > 0 || searchValue.trim() !== "";
  const appliedFilters: FilterChip[] = [];
  if (filters.type !== "all") {
    appliedFilters.push({
      id: "type",
      label: `Type: ${TRANSACTION_TYPE_FILTER_LABELS[filters.type]}`,
      onRemove: () => onFiltersChange({ ...filters, type: "all" }),
    });
  }
  if (filters.timeRange !== "all") {
    appliedFilters.push({
      id: "time",
      label: TIME_RANGE_LABELS[filters.timeRange],
      onRemove: () => onFiltersChange({ ...filters, timeRange: "all" }),
    });
  }

  return (
    <div className="space-y-4">
      {showHeading ? (
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Transactions</h2>
        </div>
      ) : null}
      <ListToolbar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search by type, status, note, or amount"
        appliedFilters={appliedFilters}
        onClearFilters={
          hasFilters
            ? () => {
                onSearchChange("");
                onFiltersChange({ type: "all", timeRange: "all" });
              }
            : undefined
        }
        onReload={onReload}
        isLoading={isLoading}
        countLabel={
          hasFilters
            ? `${totalCount} of ${unfilteredCount} ${
                unfilteredCount === 1 ? "transaction" : "transactions"
              }`
            : `${totalCount} ${totalCount === 1 ? "transaction" : "transactions"}`
        }
        filterGroups={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ListToolbarFilterTrigger label="Type" count={typeActive} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
                      {TRANSACTION_TYPE_FILTER_LABELS[type]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ListToolbarFilterTrigger label="Time" count={timeActive} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Time</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.timeRange}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      timeRange: value as TransactionFilters["timeRange"],
                    })
                  }
                >
                  <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="7d">Last 7 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30d">Last 30 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="90d">Last 90 days</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        {toolbarActions}
      </ListToolbar>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className={cn(DESKTOP_TABLE, "divide-y divide-border")}>
          <div
            className={cn(
              DESKTOP_ROW,
              "border-b border-border bg-muted/30 py-3 text-sm font-medium text-muted-foreground"
            )}
          >
            <TableCell className="min-w-0 pl-6">Transaction</TableCell>
            <TableCell>Status</TableCell>
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
