"use client";

import * as React from "react";
import Link from "next/link";
import { createApiClient, formatCurrency, getUserPortalStatusToken, useAuthToken } from "@cashsouk/config";
import { ListToolbar, ListToolbarFilterTrigger, StatusBadge, type FilterChip } from "@cashsouk/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
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
  formatSignedTransactionAmount,
  formatTransactionDateTime,
  getTransactionAmountToneClassName,
} from "./transaction-utils";

const DESKTOP_TABLE =
  "hidden lg:grid lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] lg:gap-x-6";

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

function DepositReceiptActions({ gatewayPaymentId }: { gatewayPaymentId: string }) {
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );

  const receiptPdfQuery = useMutation({
    mutationFn: async ({ mode }: { mode: "view" | "download" }) => {
      const response = await apiClient.get<{
        url: string | null;
        expiresIn: number | null;
        fileName: string | null;
        mode: "view" | "download";
        hasPdf: boolean;
        receiptStatus: string | null;
      }>(`/v1/investor/deposits/${gatewayPaymentId}/receipt/pdf?mode=${mode}`);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });

  async function openReceipt(mode: "view" | "download") {
    try {
      const data = await receiptPdfQuery.mutateAsync({ mode });
      if (!data.url) {
        const status = data.receiptStatus ? ` (${data.receiptStatus})` : "";
        toast.info(`Receipt is not available yet${status}.`);
        return;
      }

      if (mode === "view") {
        window.open(data.url, "_blank", "noopener,noreferrer");
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = data.url;
      if (data.fileName) anchor.download = data.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open receipt");
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-xl"
        disabled={receiptPdfQuery.isPending}
        onClick={() => void openReceipt("view")}
      >
        View receipt
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-xl"
        disabled={receiptPdfQuery.isPending}
        onClick={() => void openReceipt("download")}
      >
        Download
      </Button>
    </div>
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
        {tx.type === "Deposit" && tx.receiptGatewayPaymentId ? (
          <DepositReceiptActions gatewayPaymentId={tx.receiptGatewayPaymentId} />
        ) : null}
      </TableCell>
      <TableCell className="self-center">
        <TransactionStatusBadge tx={tx} />
      </TableCell>
      <TableCell
        className={cn(
          "self-center whitespace-nowrap text-right font-medium tabular-nums",
          amountToneClassName
        )}
      >
        {formatSignedTransactionAmount(tx.direction, tx.amount)}
      </TableCell>
      <TableCell className="self-center whitespace-nowrap text-right font-medium tabular-nums">
        {formatCurrency(tx.balance)}
      </TableCell>
      <TableCell className="self-center pr-6 text-right text-sm tabular-nums text-muted-foreground whitespace-nowrap">
        {formatTransactionDateTime(tx.postedAt)}
      </TableCell>
    </div>
  );
}

function MobileTransactionRow({ tx }: { tx: Transaction }) {
  const amountToneClassName = getTransactionAmountToneClassName(tx.direction);

  return (
    <div className="space-y-2 px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="font-medium">{tx.title}</p>
          <TransactionStatusBadge tx={tx} showEmpty={false} />
          <TransactionContextSubtitle context={tx.context} />
          {tx.type === "Deposit" && tx.receiptGatewayPaymentId ? (
            <DepositReceiptActions gatewayPaymentId={tx.receiptGatewayPaymentId} />
          ) : null}
        </div>
        <div className={cn("shrink-0 font-medium tabular-nums", amountToneClassName)}>
          {formatSignedTransactionAmount(tx.direction, tx.amount)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">{formatCurrency(tx.balance)}</span>
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
        searchPlaceholder="Search by type, status, note, withdrawal reference, or amount"
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
            <TableCell className="text-right">Amount</TableCell>
            <TableCell className="text-right">Balance</TableCell>
            <TableCell className="pr-6 text-right whitespace-nowrap">Time</TableCell>
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
