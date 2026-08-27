"use client";

import * as React from "react";
import { TableBody } from "@/components/ui/table";
import { AccessLogTableRow } from "./access-log-table-row";
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { accessLogToAuditDetail } from "@/components/audit/audit-adapters";
import {
  AuditLogEmptyRow,
  AuditLogHead,
  AuditLogHeaderRow,
  AuditLogSkeletonRows,
  AuditLogTable,
  AuditLogTableShell,
} from "@/components/audit/audit-log-shell";
import type { AccessLogResponse } from "@cashsouk/types";

interface AccessLog extends Omit<AccessLogResponse, "created_at" | "event_type"> {
  created_at: Date;
  event_type: string;
}

interface AccessLogsTableProps {
  logs: AccessLog[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalLogs: number;
  onPageChange: (page: number) => void;
  labelOverrides?: Record<string, string>;
}

const COLUMN_COUNT = 8;

export function AccessLogsTable({
  logs,
  loading,
  currentPage,
  pageSize,
  totalLogs,
  onPageChange,
  labelOverrides,
}: AccessLogsTableProps) {
  const [selectedLog, setSelectedLog] = React.useState<AccessLog | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleViewDetails = (log: AccessLog) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));

  return (
    <>
      <AuditLogTableShell
        pagination={
          loading
            ? null
            : {
                currentPage,
                totalPages,
                pageSize,
                totalItems: totalLogs,
                onPageChange,
              }
        }
      >
        <AuditLogTable>
          <AuditLogHeaderRow>
            <AuditLogHead>Timestamp</AuditLogHead>
            <AuditLogHead>Event</AuditLogHead>
            <AuditLogHead>Actor</AuditLogHead>
            <AuditLogHead>Source</AuditLogHead>
            <AuditLogHead>IP Address</AuditLogHead>
            <AuditLogHead>Device</AuditLogHead>
            <AuditLogHead>Status</AuditLogHead>
            <AuditLogHead align="right">Actions</AuditLogHead>
          </AuditLogHeaderRow>
          <TableBody>
            {loading ? (
              <AuditLogSkeletonRows columns={COLUMN_COUNT} />
            ) : logs.length === 0 ? (
              <AuditLogEmptyRow colSpan={COLUMN_COUNT} />
            ) : (
              logs.map((log) => (
                <AccessLogTableRow
                  key={log.id}
                  log={log}
                  onViewDetails={() => handleViewDetails(log)}
                  labelOverrides={labelOverrides}
                />
              ))
            )}
          </TableBody>
        </AuditLogTable>
      </AuditLogTableShell>

      <AuditDetailDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={selectedLog ? accessLogToAuditDetail(selectedLog, labelOverrides) : null}
      />
    </>
  );
}
