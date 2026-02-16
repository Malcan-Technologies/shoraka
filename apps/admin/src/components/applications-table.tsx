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
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { ApplicationListItem } from "@cashsouk/types";

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
        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex}-{endIndex} of {totalApplications}
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
              disabled={currentPage === totalPages}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
