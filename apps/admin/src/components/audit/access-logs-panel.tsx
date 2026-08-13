"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AccessLogsTable } from "@/components/access-logs-table";
import { AccessLogsToolbar } from "@/components/access-logs-toolbar";
import { useAccessLogs } from "@/hooks/use-access-logs";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import { ACCESS_AUDIT_EVENTS, type AccessAuditEventType, type GetAccessLogsParams } from "@cashsouk/types";

const ACCESS_EVENT_OPTIONS = ACCESS_AUDIT_EVENTS.map((value) => ({
  value,
  label: value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase()),
}));

export function AccessLogsPanel() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dateRangeFilter, setDateRangeFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 15;

  const apiParams = React.useMemo(() => {
    const params: GetAccessLogsParams = {
      page: currentPage,
      pageSize,
      dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
    };
    if (searchQuery) params.search = searchQuery;
    if (eventTypeFilter !== "all") params.eventType = eventTypeFilter as AccessAuditEventType;
    if (statusFilter !== "all") params.status = statusFilter as "success" | "failed";
    return params;
  }, [currentPage, pageSize, searchQuery, eventTypeFilter, statusFilter, dateRangeFilter]);

  const { data, isLoading, error } = useAccessLogs(apiParams);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, eventTypeFilter, statusFilter, dateRangeFilter]);

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="access logs" />;
  }

  const logs = data?.logs || [];
  const totalLogs = data?.pagination.totalCount || 0;

  return (
    <div className="space-y-6">
      <AccessLogsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        eventTypeFilter={eventTypeFilter}
        onEventTypeFilterChange={setEventTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        dateRangeFilter={dateRangeFilter}
        onDateRangeFilterChange={setDateRangeFilter}
        totalCount={totalLogs}
        filteredCount={totalLogs}
        onClearFilters={() => {
          setSearchQuery("");
          setEventTypeFilter("all");
          setStatusFilter("all");
          setDateRangeFilter("all");
          setCurrentPage(1);
        }}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["admin", "access-logs"] })}
        isLoading={isLoading}
        eventTypeOptions={ACCESS_EVENT_OPTIONS}
        showStatusFilter={false}
        exportKind="access"
        exportFilters={{
          search: searchQuery || undefined,
          eventType: eventTypeFilter !== "all" ? (eventTypeFilter as AccessAuditEventType) : undefined,
          dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
        }}
      />
      <AccessLogsTable
        logs={logs.map((log) => ({
          id: log.id,
          eventType: log.eventType,
          occurredAt: log.occurredAt,
          actorName: log.actor.displayName,
          actorEmail: log.actor.email,
          ipAddress: log.ipAddress,
          deviceInfo: log.deviceInfo,
          metadata: log.metadata,
        }))}
        loading={isLoading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalLogs={totalLogs}
        onPageChange={setCurrentPage}
        emptyLabel="No access logs found"
      />
    </div>
  );
}
