"use client";

import { useState } from "react";
import { createApiClient, useAdminNotifications, useAuthToken } from "@cashsouk/config";
import { ListToolbar, type FilterChip } from "@cashsouk/ui";
import type { AdminNotificationLog, AdminNotificationType, NotificationLogSource } from "@cashsouk/types";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { notificationLogToAuditDetail } from "@/components/audit/audit-adapters";
import { formatAuditDateTime } from "@/components/audit/audit-presentation";
import { AuditEventBadge } from "@/components/audit/audit-event-badge";
import { AuditLogActorCell } from "@/components/audit/audit-log-actor-cell";
import {
  AuditLogFilterOption,
  AuditLogFilterSection,
  AuditLogFilters,
} from "@/components/audit/audit-log-filters";
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
  AuditLogViewDetailsButton,
  auditExportButtonClassName,
  auditRecordCountLabel,
} from "@/components/audit/audit-log-shell";
import { buildAuditCsv, downloadAuditCsv } from "@/components/audit/audit-csv";

const TARGET_LABELS: Record<string, string> = {
  ALL_USERS: "All Users",
  INVESTORS: "Investors",
  ISSUERS: "Issuers",
  SPECIFIC_USERS: "Specific Users",
  GROUP: "Group",
};

const LOG_TARGET_OPTIONS = [
  { value: "ALL_USERS", label: "All Users" },
  { value: "INVESTORS", label: "Investors" },
  { value: "ISSUERS", label: "Issuers" },
  { value: "SPECIFIC_USERS", label: "Specific Users" },
  { value: "GROUP", label: "Group" },
] as const;

const NOTIFICATION_LOG_COLUMNS = 7;

function audienceLabel(targetType: string): string {
  return TARGET_LABELS[targetType] ?? targetType.replaceAll("_", " ");
}

export function NotificationLogsPanel() {
  const { getAccessToken } = useAuthToken();
  const [page, setPage] = useState(1);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState("all");
  const [logTargetFilter, setLogTargetFilter] = useState("all");
  const [logSourceFilter, setLogSourceFilter] = useState<"all" | NotificationLogSource>("all");
  const [selectedLog, setSelectedLog] = useState<AdminNotificationLog | null>(null);
  const [isLogDetailsOpen, setIsLogDetailsOpen] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);
  const limit = AUDIT_LOG_PAGE_SIZE;

  const { types, logs, isLoadingLogs, paginationLogs, refetchLogs } = useAdminNotifications({
    limit,
    offset: (page - 1) * limit,
    search: logSearchQuery || undefined,
    type: logTypeFilter !== "all" ? logTypeFilter : undefined,
    target: logTargetFilter !== "all" ? logTargetFilter : undefined,
    source: logSourceFilter !== "all" ? logSourceFilter : undefined,
  });

  const handleExportNotificationLogs = async () => {
    setExportingLogs(true);
    try {
      const apiClient = createApiClient(undefined, getAccessToken);
      const pageSize = 100;
      const all: AdminNotificationLog[] = [];
      let offset = 0;
      while (true) {
        const response = await apiClient.getAdminNotificationLogs({
          limit: pageSize,
          offset,
          search: logSearchQuery || undefined,
          type: logTypeFilter !== "all" ? logTypeFilter : undefined,
          target: logTargetFilter !== "all" ? logTargetFilter : undefined,
          source: logSourceFilter !== "all" ? logSourceFilter : undefined,
        });
        if ("error" in response) throw new Error(response.error.message);
        all.push(...response.data.items);
        if (all.length >= response.data.pagination.total || response.data.items.length === 0) break;
        offset += pageSize;
      }
      const csv = buildAuditCsv(
        all.map((log) => ({
          timestamp: log.created_at,
          event: log.notification_type?.name || log.notification_type_id,
          eventType: log.notification_type_id,
          actor: log.admin ? `${log.admin.first_name} ${log.admin.last_name}` : "System",
          actorType: log.source === "SYSTEM" || !log.admin ? "SYSTEM" : "ADMIN",
          actorEmail: log.admin?.email,
          source: log.source,
          targetType: log.target_type,
          targetReference: log.target_group_id,
          reason: log.message,
          metadata: log.metadata,
          extra: {
            "Notification Type": log.notification_type?.name || log.notification_type_id,
            "Platform Delivered": log.delivered_platform_count,
            "Email Delivered": log.delivered_email_count,
            "Idempotency Key": log.idempotency_key,
            Title: log.title,
          },
        })),
        ["Notification Type", "Platform Delivered", "Email Delivered", "Idempotency Key", "Title"]
      );
      downloadAuditCsv(`notification-logs-${new Date().toISOString().split("T")[0]}.csv`, csv);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export notification logs");
    } finally {
      setExportingLogs(false);
    }
  };

  const hasLogFilters =
    Boolean(logSearchQuery) ||
    logTypeFilter !== "all" ||
    logTargetFilter !== "all" ||
    logSourceFilter !== "all";

  const logFilterChips: FilterChip[] = [];
  if (logTypeFilter !== "all") {
    logFilterChips.push({
      id: "type",
      label: `Type: ${types.find((type: AdminNotificationType) => type.id === logTypeFilter)?.name ?? logTypeFilter}`,
      onRemove: () => {
        setLogTypeFilter("all");
        setPage(1);
      },
    });
  }
  if (logTargetFilter !== "all") {
    logFilterChips.push({
      id: "target",
      label: `Audience: ${LOG_TARGET_OPTIONS.find((option) => option.value === logTargetFilter)?.label ?? logTargetFilter}`,
      onRemove: () => {
        setLogTargetFilter("all");
        setPage(1);
      },
    });
  }
  if (logSourceFilter !== "all") {
    logFilterChips.push({
      id: "source",
      label: `Source: ${logSourceFilter === "SYSTEM" ? "System" : "Admin"}`,
      onRemove: () => {
        setLogSourceFilter("all");
        setPage(1);
      },
    });
  }

  const clearLogFilters = () => {
    setLogSearchQuery("");
    setLogTypeFilter("all");
    setLogTargetFilter("all");
    setLogSourceFilter("all");
    setPage(1);
  };

  const openLogDetails = (log: AdminNotificationLog) => {
    setSelectedLog(log);
    setIsLogDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <p className="text-ui text-muted-foreground">
        Each row is one send. Custom messages from Custom & Groups appear as a single Admin row with
        the audience size — not one line per recipient. Delivery counts are what actually happened,
        not the channel switches on Configuration.
      </p>
      <ListToolbar
        searchValue={logSearchQuery}
        onSearchChange={(value) => {
          setLogSearchQuery(value);
          setPage(1);
        }}
        searchPlaceholder="Search title, message, type, or admin..."
        appliedFilters={logFilterChips}
        onClearFilters={hasLogFilters ? clearLogFilters : undefined}
        onReload={() => refetchLogs()}
        isLoading={isLoadingLogs}
        countLabel={auditRecordCountLabel(paginationLogs?.total || 0)}
        filterGroups={
          <AuditLogFilters
            activeCount={
              [logTypeFilter !== "all", logTargetFilter !== "all", logSourceFilter !== "all"].filter(
                Boolean
              ).length
            }
          >
            <AuditLogFilterSection title="Type">
              <AuditLogFilterOption
                selected={logTypeFilter === "all"}
                onSelect={() => {
                  setLogTypeFilter("all");
                  setPage(1);
                }}
              >
                All types
              </AuditLogFilterOption>
              {types.map((type: AdminNotificationType) => (
                <AuditLogFilterOption
                  key={type.id}
                  selected={logTypeFilter === type.id}
                  onSelect={() => {
                    setLogTypeFilter(type.id);
                    setPage(1);
                  }}
                >
                  {type.name}
                </AuditLogFilterOption>
              ))}
            </AuditLogFilterSection>
            <AuditLogFilterSection title="Audience">
              <AuditLogFilterOption
                selected={logTargetFilter === "all"}
                onSelect={() => {
                  setLogTargetFilter("all");
                  setPage(1);
                }}
              >
                All audiences
              </AuditLogFilterOption>
              {LOG_TARGET_OPTIONS.map((option) => (
                <AuditLogFilterOption
                  key={option.value}
                  selected={logTargetFilter === option.value}
                  onSelect={() => {
                    setLogTargetFilter(option.value);
                    setPage(1);
                  }}
                >
                  {option.label}
                </AuditLogFilterOption>
              ))}
            </AuditLogFilterSection>
            <AuditLogFilterSection title="Source">
              <AuditLogFilterOption
                selected={logSourceFilter === "all"}
                onSelect={() => {
                  setLogSourceFilter("all");
                  setPage(1);
                }}
              >
                All sources
              </AuditLogFilterOption>
              <AuditLogFilterOption
                selected={logSourceFilter === "ADMIN"}
                onSelect={() => {
                  setLogSourceFilter("ADMIN");
                  setPage(1);
                }}
              >
                Admin
              </AuditLogFilterOption>
              <AuditLogFilterOption
                selected={logSourceFilter === "SYSTEM"}
                onSelect={() => {
                  setLogSourceFilter("SYSTEM");
                  setPage(1);
                }}
              >
                System
              </AuditLogFilterOption>
            </AuditLogFilterSection>
          </AuditLogFilters>
        }
      >
        <Button
          variant="outline"
          onClick={() => void handleExportNotificationLogs()}
          disabled={exportingLogs || (paginationLogs?.total ?? 0) === 0}
          className={auditExportButtonClassName()}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {exportingLogs ? "Exporting..." : "Export"}
        </Button>
      </ListToolbar>

      <AuditLogTableShell
        pagination={
          isLoadingLogs
            ? null
            : {
                currentPage: page,
                totalPages: paginationLogs?.pages ?? 0,
                pageSize: limit,
                totalItems: paginationLogs?.total ?? 0,
                onPageChange: setPage,
              }
        }
      >
        <AuditLogTable>
          <AuditLogHeaderRow>
            <AuditLogHead>Timestamp</AuditLogHead>
            <AuditLogHead>Event</AuditLogHead>
            <AuditLogHead>Actor/Source</AuditLogHead>
            <AuditLogHead>Audience</AuditLogHead>
            <AuditLogHead>Platform Delivered</AuditLogHead>
            <AuditLogHead>Email Delivered</AuditLogHead>
            <AuditLogHead align="right">Actions</AuditLogHead>
          </AuditLogHeaderRow>
          <TableBody>
            {isLoadingLogs ? (
              <AuditLogSkeletonRows columns={NOTIFICATION_LOG_COLUMNS} />
            ) : logs.length === 0 ? (
              <AuditLogEmptyRow colSpan={NOTIFICATION_LOG_COLUMNS} />
            ) : (
              logs.map((log: AdminNotificationLog) => (
                <TableRow
                  key={log.id}
                  className={AUDIT_ROW_CLASS}
                  onClick={() => openLogDetails(log)}
                >
                  <TableCell className={AUDIT_TIMESTAMP_CELL_CLASS}>
                    {formatAuditDateTime(log.created_at)}
                  </TableCell>
                  <TableCell>
                    <AuditEventBadge
                      eventType={log.notification_type_id}
                      label={log.notification_type?.name || log.title || "Custom"}
                    />
                  </TableCell>
                  <AuditLogActorCell
                    name={
                      log.source === "SYSTEM" || !log.admin
                        ? "System"
                        : `${log.admin.first_name} ${log.admin.last_name}`.trim()
                    }
                    email={log.source === "SYSTEM" || !log.admin ? null : log.admin.email}
                    actorType={log.source === "SYSTEM" || !log.admin ? "SYSTEM" : "ADMIN"}
                  />
                  <TableCell className="text-ui">{audienceLabel(log.target_type)}</TableCell>
                  <TableCell className="text-ui tabular-nums">
                    {log.delivered_platform_count}
                  </TableCell>
                  <TableCell className="text-ui tabular-nums">{log.delivered_email_count}</TableCell>
                  <TableCell className="text-right">
                    <AuditLogViewDetailsButton
                      onClick={(event) => {
                        event.stopPropagation();
                        openLogDetails(log);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </AuditLogTable>
      </AuditLogTableShell>

      <AuditDetailDrawer
        open={isLogDetailsOpen}
        onOpenChange={setIsLogDetailsOpen}
        record={selectedLog ? notificationLogToAuditDetail(selectedLog) : null}
      />
    </div>
  );
}
