"use client";

import * as React from "react";
import { ListToolbar, StatusBadge } from "@cashsouk/ui";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import {
  OPS_ALERT_TYPE_LABELS,
  type OpsAlertSeverity,
  type OpsAlertStatus,
  type OpsAlertType,
} from "@cashsouk/types";
import { useOpsAlertAction, useOpsAlerts } from "@/hooks/use-ops-alerts";
import {
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_ROW_CLASS,
  AUDIT_TIMESTAMP_CELL_CLASS,
  AuditLogEmptyRow,
  AuditLogHead,
  AuditLogHeaderRow,
  AuditLogSkeletonRows,
  AuditLogTable,
  AuditLogTableShell,
} from "@/components/audit/audit-log-shell";
import { formatAuditDateTime } from "@/components/audit/audit-presentation";
import {
  AuditLogFilterOption,
  AuditLogFilterSection,
  AuditLogFilters,
} from "@/components/audit/audit-log-filters";
import { toast } from "sonner";

const COLUMN_COUNT = 8;
const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

function severityStatus(severity: OpsAlertSeverity) {
  if (severity === "CRITICAL") return "rejected" as const;
  if (severity === "HIGH") return "action" as const;
  if (severity === "MEDIUM") return "in-progress" as const;
  return "neutral" as const;
}

function alertStatus(status: OpsAlertStatus) {
  if (status === "OPEN") return "action" as const;
  if (status === "ACKNOWLEDGED") return "submitted" as const;
  if (status === "RESOLVED") return "success" as const;
  return "neutral" as const;
}

export function OpsAlertsPanel() {
  const action = useOpsAlertAction();
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("OPEN");

  const { data, isLoading, error, refetch } = useOpsAlerts({
    page,
    pageSize: AUDIT_LOG_PAGE_SIZE,
    search: searchQuery || undefined,
    status: statusFilter === "all" ? undefined : (statusFilter as OpsAlertStatus),
  });

  const alerts = data?.alerts ?? [];
  const total = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;

  const runAction = async (id: string, next: "acknowledge" | "resolve" | "close") => {
    try {
      await action.mutateAsync({ id, action: next });
      toast.success("Ops alert updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update alert");
    }
  };

  return (
    <div className="space-y-4">
      <ListToolbar
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setPage(1);
        }}
        searchPlaceholder="Search alerts"
        onReload={() => void refetch()}
        isLoading={isLoading}
        countLabel={`${total} ${total === 1 ? "alert" : "alerts"}`}
        filterGroups={
          <AuditLogFilters activeCount={statusFilter === "all" ? 0 : 1}>
            <AuditLogFilterSection title="Status">
              {STATUS_FILTERS.map((option) => (
                <AuditLogFilterOption
                  key={option.value}
                  selected={statusFilter === option.value}
                  onSelect={() => {
                    setStatusFilter(option.value);
                    setPage(1);
                  }}
                >
                  {option.label}
                </AuditLogFilterOption>
              ))}
            </AuditLogFilterSection>
          </AuditLogFilters>
        }
      />
      {error ? <AdminQueryErrorState error={error} /> : null}
      <AuditLogTableShell
        pagination={{
          currentPage: page,
          totalPages,
          pageSize: AUDIT_LOG_PAGE_SIZE,
          totalItems: total,
          onPageChange: setPage,
        }}
      >
        <AuditLogTable>
          <AuditLogHeaderRow>
            <AuditLogHead>Opened</AuditLogHead>
            <AuditLogHead>Type</AuditLogHead>
            <AuditLogHead>Severity</AuditLogHead>
            <AuditLogHead>Status</AuditLogHead>
            <AuditLogHead>Title</AuditLogHead>
            <AuditLogHead>Entity</AuditLogHead>
            <AuditLogHead>Count</AuditLogHead>
            <AuditLogHead>Actions</AuditLogHead>
          </AuditLogHeaderRow>
          <TableBody>
            {isLoading ? (
              <AuditLogSkeletonRows columns={COLUMN_COUNT} />
            ) : alerts.length === 0 ? (
              <AuditLogEmptyRow colSpan={COLUMN_COUNT} message="No ops alerts." />
            ) : (
              alerts.map((alert) => (
                <TableRow key={alert.id} className={AUDIT_ROW_CLASS}>
                  <TableCell className={AUDIT_TIMESTAMP_CELL_CLASS}>
                    {formatAuditDateTime(alert.createdAt)}
                  </TableCell>
                  <TableCell className="text-ui">
                    {OPS_ALERT_TYPE_LABELS[alert.type as OpsAlertType] ?? alert.type}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={severityStatus(alert.severity)} label={alert.severity} showDot={false} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={alertStatus(alert.status)} label={alert.status} showDot={false} />
                  </TableCell>
                  <TableCell className="max-w-sm text-ui">
                    <div>{alert.title}</div>
                    {alert.summary ? (
                      <div className="text-meta text-muted-foreground">{alert.summary}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-meta">
                    {alert.entityType && alert.entityId
                      ? `${alert.entityType}:${alert.entityId}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-ui">{alert.occurrenceCount}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {alert.status === "OPEN" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void runAction(alert.id, "acknowledge")}
                        >
                          Acknowledge
                        </Button>
                      ) : null}
                      {alert.status === "OPEN" || alert.status === "ACKNOWLEDGED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void runAction(alert.id, "resolve")}
                        >
                          Resolve
                        </Button>
                      ) : null}
                      {alert.status !== "CLOSED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void runAction(alert.id, "close")}
                        >
                          Close
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </AuditLogTable>
      </AuditLogTableShell>
    </div>
  );
}
