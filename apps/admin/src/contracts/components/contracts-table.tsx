import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@cashsouk/ui";
import { ContractsTableRow } from "./contracts-table-row";
import type { ContractListItem } from "@cashsouk/types";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";

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
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  );
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

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-sm font-semibold">Contract Ref</TableHead>
              <TableHead className="text-sm font-semibold">Contract Number</TableHead>
              <TableHead className="text-sm font-semibold">Contract Title</TableHead>
              <TableHead className="text-sm font-semibold">Organization</TableHead>
              <TableHead className="text-sm font-semibold">Contract Value</TableHead>
              <TableHead className="text-sm font-semibold">Status</TableHead>
              <TableHead className="text-sm font-semibold">Updated</TableHead>
              <TableHead className="text-sm font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No contracts found
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((contract) => (
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
