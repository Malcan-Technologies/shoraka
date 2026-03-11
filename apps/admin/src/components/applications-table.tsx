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
import { ApplicationsTableRow } from "./applications-table-row";
import type { ApplicationListItem } from "@cashsouk/types";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";

interface ApplicationsTableProps {
  applications: ApplicationListItem[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalApplications: number;
  onPageChange: (page: number) => void;
  onViewDetails?: (application: ApplicationListItem) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-40" /></TableCell>
          <TableCell><Skeleton className="h-5 w-32" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function ApplicationsTable({
  applications,
  loading,
  currentPage,
  pageSize,
  totalApplications,
  onPageChange,
  onViewDetails,
}: ApplicationsTableProps) {
  const totalPages = Math.ceil(totalApplications / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalApplications);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-sm font-semibold">Reference</TableHead>
              <TableHead className="text-sm font-semibold">Applicant</TableHead>
              <TableHead className="text-sm font-semibold">Financing Structure</TableHead>
              <TableHead className="text-sm font-semibold">Requested Amount</TableHead>
              <TableHead className="text-sm font-semibold">Submitted</TableHead>
              <TableHead className="text-sm font-semibold">Status</TableHead>
              <TableHead className="text-sm font-semibold">Updated</TableHead>
              <TableHead className="text-sm font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No applications found
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app) => (
                <ApplicationsTableRow
                  key={app.id}
                  application={app}
                  onViewDetails={onViewDetails}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && applications.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalApplications}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
