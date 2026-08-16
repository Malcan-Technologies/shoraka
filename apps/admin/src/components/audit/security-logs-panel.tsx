"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AccessLogsTable } from "@/components/access-logs-table";
import { AccessLogsToolbar } from "@/components/access-logs-toolbar";
import { useSecurityLogs } from "@/hooks/use-security-logs";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import {
  SECURITY_AUDIT_EVENTS,
  type GetSecurityLogsParams,
  type SecurityEventType,
} from "@cashsouk/types";

const SECURITY_EVENT_OPTIONS = SECURITY_AUDIT_EVENTS.map((value) => ({
  value,
  label: value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase()),
}));

export function SecurityLogsPanel() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dateRangeFilter, setDateRangeFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 15;

  const apiParams = React.useMemo(() => {
    const params: GetSecurityLogsParams = {
      page: currentPage,
      pageSize,
      dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
    };
    if (searchQuery) params.search = searchQuery;
    if (eventTypeFilter !== "all") params.eventType = eventTypeFilter as SecurityEventType;
    return params;
  }, [currentPage, pageSize, searchQuery, eventTypeFilter, dateRangeFilter]);

  const { data, isLoading, error } = useSecurityLogs(apiParams);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, eventTypeFilter, statusFilter, dateRangeFilter]);

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="security logs" />;
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
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["admin", "security-logs"] })}
        isLoading={isLoading}
        eventTypeOptions={SECURITY_EVENT_OPTIONS}
        showStatusFilter={false}
        exportKind="security"
        exportFilters={{
          search: searchQuery || undefined,
          eventType: eventTypeFilter !== "all" ? (eventTypeFilter as SecurityEventType) : undefined,
          dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
        }}
      />
      <AccessLogsTable
        logs={logs.map((log) => ({
          id: log.id,
          eventType: log.eventType,
          occurredAt: log.occurredAt,
          createdAt: log.createdAt,
          actorName: log.actor.displayName,
          actorEmail: log.actor.email,
          actorType: log.actor.type,
          actorUserId: log.actor.userId,
          subjectUserId: log.subjectUserId,
          organizationId: log.organizationId,
          organizationKind: log.organizationKind,
          targetType: log.target.type,
          targetId: log.target.id,
          source: log.source,
          portal: log.portal,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          deviceInfo: log.deviceInfo,
          correlationId: log.correlationId,
          metadata: log.metadata,
        }))}
        loading={isLoading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalLogs={totalLogs}
        onPageChange={setCurrentPage}
        emptyLabel="No security logs found"
      />
    </div>
  );
}
