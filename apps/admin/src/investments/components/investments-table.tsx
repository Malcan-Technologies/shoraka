import * as React from "react";
import type { AdminInvestmentItem } from "@cashsouk/types";
import { Skeleton } from "@cashsouk/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";
import { InvestmentsTableRow } from "./investments-table-row";

interface InvestmentsTableProps {
  investments: AdminInvestmentItem[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalInvestments: number;
  onPageChange: (page: number) => void;
  onViewNote: (investment: AdminInvestmentItem) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          {Array.from({ length: 8 }).map((__, cellIndex) => (
            <TableCell key={cellIndex}>
              <Skeleton className="h-5 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function InvestmentsTable({
  investments,
  loading,
  currentPage,
  pageSize,
  totalInvestments,
  onPageChange,
  onViewNote,
}: InvestmentsTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalInvestments / pageSize));
  const startIndex = totalInvestments === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalInvestments);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="w-full overflow-x-auto">
        <Table className="w-full table-fixed">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="truncate">Note ref</TableHead>
              <TableHead className="truncate">Note / Issuer</TableHead>
              <TableHead className="truncate">Investor</TableHead>
              <TableHead className="truncate">Amount</TableHead>
              <TableHead className="truncate text-right">Allocation</TableHead>
              <TableHead className="truncate">Status</TableHead>
              <TableHead className="truncate">Committed</TableHead>
              <TableHead className="truncate">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : investments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No investments found
                </TableCell>
              </TableRow>
            ) : (
              investments.map((investment) => (
                <InvestmentsTableRow
                  key={investment.id}
                  investment={investment}
                  onViewNote={onViewNote}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!loading && totalInvestments > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalInvestments}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
