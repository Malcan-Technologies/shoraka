"use client";

import * as React from "react";
import { Skeleton } from "@cashsouk/ui";
import type { ContractListItem } from "@cashsouk/types";
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
import { timestampOrNull } from "@/shared/admin-list/table-sort";
import { useTableSort } from "@/shared/admin-list/use-table-sort";
import { ContractsTableRow } from "./contracts-table-row";

type ContractsSortColumn = "value" | "approved" | "utilization" | "updated";

interface ContractsTableProps {
  contracts: ContractListItem[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalContracts: number;
  onPageChange: (page: number) => void;
  onViewDetails?: (contract: ContractListItem) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-36" /></TableCell>
          <TableCell><Skeleton className="h-5 w-44" /></TableCell>
          <TableCell><Skeleton className="h-5 w-44" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-40" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function contractsSortValue(contract: ContractListItem, column: ContractsSortColumn): number | null {
  if (column === "value") return contract.contractValue;
  if (column === "approved") return contract.approvedFacility;
  if (column === "updated") return timestampOrNull(contract.updatedAt);
  return contract.approvedFacility > 0
    ? (contract.utilizedFacility / contract.approvedFacility) * 100
    : null;
}

export function ContractsTable({
  contracts,
  loading,
  currentPage,
  pageSize,
  totalContracts,
  onPageChange,
  onViewDetails,
}: ContractsTableProps) {
  const totalPages = Math.ceil(totalContracts / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalContracts);
  const { sortedRows, sortColumn, sortDirection, onSort } = useTableSort(
    contracts,
    contractsSortValue
  );

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-sm font-semibold">Facility Ref</TableHead>
              <TableHead className="text-sm font-semibold">Number</TableHead>
              <TableHead className="text-sm font-semibold">Title</TableHead>
              <TableHead className="text-sm font-semibold">Organization</TableHead>
              <SortableTableHead
                column="value"
                label="Value"
                className="text-sm font-semibold"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortableTableHead
                column="approved"
                label="Approved"
                className="text-sm font-semibold"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortableTableHead
                column="utilization"
                label="Utilization"
                className="text-sm font-semibold"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <TableHead className="text-sm font-semibold">Status</TableHead>
              <SortableTableHead
                column="updated"
                label="Updated"
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
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  No facilities found
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((contract) => (
                <ContractsTableRow
                  key={contract.id}
                  contract={contract}
                  onViewDetails={onViewDetails}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && contracts.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalContracts}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
