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
import { GuarantorsTableRow } from "./guarantors-table-row";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import type { GuarantorListItem } from "@cashsouk/types";

interface GuarantorsTableProps {
  guarantors: GuarantorListItem[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalGuarantors: number;
  onPageChange: (page: number) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-44" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function GuarantorsTable({
  guarantors,
  loading,
  currentPage,
  pageSize,
  totalGuarantors,
  onPageChange,
}: GuarantorsTableProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(totalGuarantors / pageSize));
  const startIndex = totalGuarantors === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalGuarantors);
  const columnCount = 8;

  const handleViewDetails = (guarantor: GuarantorListItem) => {
    router.push(`/guarantors/${guarantor.id}`);
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-sm font-semibold min-w-[220px] max-w-[320px]">Guarantor</TableHead>
              <TableHead className="text-sm font-semibold">Type</TableHead>
              <TableHead className="text-sm font-semibold">Onboarding</TableHead>
              <TableHead className="text-sm font-semibold">Risk</TableHead>
              <TableHead className="text-sm font-semibold">Applications</TableHead>
              <TableHead className="text-sm font-semibold">Created</TableHead>
              <TableHead className="text-sm font-semibold">Updated</TableHead>
              <TableHead className="text-sm font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : guarantors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="text-center py-10 text-muted-foreground">
                  No guarantors found
                </TableCell>
              </TableRow>
            ) : (
              guarantors.map((guarantor) => (
                <GuarantorsTableRow
                  key={guarantor.id}
                  guarantor={guarantor}
                  onViewDetails={handleViewDetails}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && guarantors.length > 0 && (
        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex}-{endIndex} of {totalGuarantors}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
