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
import {
  applicationTableHeaderClass,
  applicationTableHeaderNumericClass,
  applicationTableHeaderCenterClass,
  applicationTableWrapperClass,
} from "./application-review/application-table-styles";

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
    <div className={applicationTableWrapperClass}>
      <div className="overflow-x-auto">
        <Table className="text-[15px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className={applicationTableHeaderClass}>Reference</TableHead>
              <TableHead className={applicationTableHeaderClass}>Applicant</TableHead>
              <TableHead className={applicationTableHeaderClass}>Financing Structure</TableHead>
              <TableHead className={applicationTableHeaderNumericClass}>Requested Amount</TableHead>
              <TableHead className={applicationTableHeaderClass}>Submitted</TableHead>
              <TableHead className={applicationTableHeaderClass}>Status</TableHead>
              <TableHead className={applicationTableHeaderClass}>Updated</TableHead>
              <TableHead className={applicationTableHeaderCenterClass}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : applications.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="text-center py-10 text-[15px] text-muted-foreground">
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
