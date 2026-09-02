"use client";

import * as React from "react";
import { Skeleton } from "@cashsouk/ui";
import type { PaymasterListItem } from "@cashsouk/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/shared/admin-list/components/sortable-table-head";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";
import { useTableSort } from "@/shared/admin-list/use-table-sort";
import { PaymastersTableRow } from "@/paymasters/components/paymasters-table-row";
import { paymastersSortValue } from "@/paymasters/utils/paymasters-table-sort";

const COLUMN_COUNT = 7;

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: COLUMN_COUNT }).map((_, cell) => (
            <TableCell key={cell}>
              <Skeleton className="h-5 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function PaymastersTable({
  items,
  loading,
  currentPage,
  pageSize,
  total,
  onPageChange,
  onViewDetails,
}: {
  items: PaymasterListItem[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onViewDetails: (item: PaymasterListItem) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, total);
  const { sortedRows, sortColumn, sortDirection, onSort } = useTableSort(items, paymastersSortValue);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableTableHead
                column="paymaster"
                label="Paymaster"
                className="min-w-[180px] max-w-[320px] text-sm font-semibold"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortableTableHead
                column="issuers"
                label="Issuers"
                className="text-sm font-semibold"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortableTableHead
                column="financings"
                label="Financings"
                className="text-sm font-semibold"
                title="Linked facilities and notes"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortableTableHead
                column="notices"
                label="Notices"
                className="text-sm font-semibold"
                title="Assignment notices"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortableTableHead
                column="lastUsed"
                label="Last used"
                className="text-sm font-semibold"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortableTableHead
                column="status"
                label="Status"
                className="text-sm font-semibold"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <TableHead className="text-sm font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center text-ui text-muted-foreground">
                  No paymasters yet. They are created when issuers save Customer Details.
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((item) => (
                <PaymastersTableRow key={item.id} item={item} onViewDetails={onViewDetails} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!loading && total > 0 ? (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={total}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  );
}
