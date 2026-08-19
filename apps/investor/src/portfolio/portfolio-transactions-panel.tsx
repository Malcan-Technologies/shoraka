"use client";

import * as React from "react";
import { useOrganization } from "@cashsouk/config";
import { listToolbarControlClassName, LoadingState } from "@cashsouk/ui";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  TransactionsTable,
  type TransactionFilters,
} from "@/app/transactions/components/transactions-table";
import type { TransactionType } from "@/app/transactions/components/transactions.types";
import { mapActivityEntryToTransaction } from "@/app/transactions/components/transaction-utils";
import { runningBalancesForActivityEntries } from "@cashsouk/types";
import {
  useInvestorBalanceActivityAll,
  useInvestorInvestments,
} from "@/investments/hooks/use-marketplace-notes";
import { filterTransactions, paginateTransactions } from "./portfolio-transactions-model";

const PAGE_SIZE = 10;

export function PortfolioTransactionsPanel({
  typeFilter,
  onTypeFilterChange,
  onDownloadStatement,
}: {
  typeFilter: TransactionType | "all";
  onTypeFilterChange: (type: TransactionType | "all") => void;
  onDownloadStatement: () => void;
}) {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [timeRange, setTimeRange] = React.useState<TransactionFilters["timeRange"]>("all");

  const activityQuery = useInvestorBalanceActivityAll(orgId);
  const investmentsQuery = useInvestorInvestments(orgId);

  const filters: TransactionFilters = React.useMemo(
    () => ({ type: typeFilter, timeRange }),
    [timeRange, typeFilter]
  );

  React.useEffect(() => {
    setPage(1);
  }, [orgId, typeFilter, timeRange, search]);

  const noteReferenceById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const note of investmentsQuery.data?.notes ?? []) {
      map.set(note.id, note.noteReference);
    }
    return map;
  }, [investmentsQuery.data?.notes]);

  const allTransactions = React.useMemo(() => {
    const entries = activityQuery.data?.entries ?? [];
    if (entries.length === 0) return [];

    const sorted = [...entries].sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    );

    const runningBalances = runningBalancesForActivityEntries(
      sorted,
      Number(activityQuery.data?.summary.availableBalance ?? 0)
    );
    return sorted.map((entry, index) =>
      mapActivityEntryToTransaction(entry, runningBalances[index], noteReferenceById)
    );
  }, [activityQuery.data?.entries, activityQuery.data?.summary, noteReferenceById]);

  const filteredTransactions = React.useMemo(
    () => filterTransactions(allTransactions, filters, search),
    [allTransactions, filters, search]
  );
  const paginatedTransactions = paginateTransactions(filteredTransactions, page, PAGE_SIZE);

  function handleFiltersChange(next: TransactionFilters) {
    if (next.type !== typeFilter) {
      onTypeFilterChange(next.type);
    }
    setTimeRange(next.timeRange);
    setPage(1);
  }

  if (activityQuery.isLoading) {
    return <LoadingState variant="table" rows={6} />;
  }

  return (
    <TransactionsTable
      transactions={paginatedTransactions}
      totalCount={filteredTransactions.length}
      unfilteredCount={allTransactions.length}
      page={page}
      pageSize={PAGE_SIZE}
      searchValue={search}
      onSearchChange={setSearch}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      onPageChange={setPage}
      onReload={() => {
        void activityQuery.refetch();
        void investmentsQuery.refetch();
      }}
      isLoading={activityQuery.isFetching || investmentsQuery.isFetching}
      showHeading={false}
      toolbarActions={
        <Button
          type="button"
          variant="outline"
          className={listToolbarControlClassName}
          onClick={onDownloadStatement}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Download statement
        </Button>
      }
    />
  );
}
