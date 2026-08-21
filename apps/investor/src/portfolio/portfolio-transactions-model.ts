import {
  TRANSACTION_TYPE_FILTER_OPTIONS,
  type Transaction,
  type TransactionType,
} from "@/app/transactions/components/transactions.types";
import type { TransactionFilters } from "@/app/transactions/components/transactions-table";

export function transactionTypeFromSearchParam(value: string | null): TransactionType | "all" {
  if (value && (TRANSACTION_TYPE_FILTER_OPTIONS as readonly string[]).includes(value)) {
    return value as TransactionType;
  }
  return "all";
}

const RANGE_MS: Record<TransactionFilters["timeRange"], number | null> = {
  all: null,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export function transactionMatchesSearch(tx: Transaction, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack: string[] = [tx.type, tx.title];
  if (tx.status?.label) haystack.push(tx.status.label);
  if (tx.context.kind === "text") {
    haystack.push(tx.context.text);
  }
  if (tx.context.kind === "note-link") {
    haystack.push(tx.context.noteReferenceDisplay);
    if (tx.context.prefix) haystack.push(tx.context.prefix);
  }
  haystack.push(String(tx.amount));

  return haystack.some((part) => part.toLowerCase().includes(needle));
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  search = "",
  now = Date.now()
): Transaction[] {
  return transactions.filter((tx) => {
    if (filters.type !== "all" && tx.type !== filters.type) return false;

    const range = RANGE_MS[filters.timeRange];
    if (range !== null && now - new Date(tx.postedAt).getTime() > range) return false;

    return transactionMatchesSearch(tx, search);
  });
}

export function paginateTransactions(
  transactions: Transaction[],
  page: number,
  pageSize: number
): Transaction[] {
  const start = (page - 1) * pageSize;
  return transactions.slice(start, start + pageSize);
}
