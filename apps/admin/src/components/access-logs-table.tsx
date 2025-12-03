"use client";

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
import { AccessLogTableRow } from "./access-log-table-row";
import { AccessLogDetailsDialog } from "./access-log-details-dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { AccessLogResponse } from "@cashsouk/types";

interface AccessLog extends Omit<AccessLogResponse, "created_at"> {
  created_at: Date;
}

interface AccessLogsTableProps {
  logs: AccessLog[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalLogs: number;
  onPageChange: (page: number) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function AccessLogsTable({
  logs,
  loading,
  currentPage,
  pageSize,
  totalLogs,
  onPageChange,
}: AccessLogsTableProps) {
  const [selectedLog, setSelectedLog] = React.useState<AccessLog | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleViewDetails = (log: AccessLog) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };

  const totalPages = Math.ceil(totalLogs / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalLogs);

  return (
    <>
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-sm font-semibold">Timestamp</TableHead>
                <TableHead className="text-sm font-semibold">User</TableHead>
                <TableHead className="text-sm font-semibold">Event Type</TableHead>
                <TableHead className="text-sm font-semibold">IP Address</TableHead>
                <TableHead className="text-sm font-semibold">Device</TableHead>
                <TableHead className="text-sm font-semibold">Status</TableHead>
                <TableHead className="text-sm font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton />
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No access logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <AccessLogTableRow
                    key={log.id}
                    log={log}
                    onViewDetails={() => handleViewDetails(log)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex}-{endIndex} of {totalLogs}
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

      <AccessLogDetailsDialog open={dialogOpen} onOpenChange={setDialogOpen} log={selectedLog} />
    </>
  );
}

