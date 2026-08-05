"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AccessLogsTable } from "@/components/access-logs-table";
import { AccessLogsToolbar } from "@/components/access-logs-toolbar";
import { useSecurityLogs } from "@/hooks/use-security-logs";
import type { SecurityEventType, GetSecurityLogsParams } from "@cashsouk/types";

const SECURITY_EVENT_TYPES: SecurityEventType[] = [
  "PASSWORD_CHANGED",
  "EMAIL_CHANGED",
  "ROLE_ADDED",
  "ROLE_SWITCHED",
  "PROFILE_UPDATED",
];

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

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (eventTypeFilter !== "all") {
      params.eventType = eventTypeFilter as SecurityEventType;
    }

    return params;
  }, [currentPage, pageSize, searchQuery, eventTypeFilter, dateRangeFilter]);

  const { data, isLoading, error } = useSecurityLogs({
    ...apiParams,
    allowedEventTypes: SECURITY_EVENT_TYPES,
  });

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "security-logs"] });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setEventTypeFilter("all");
    setStatusFilter("all");
    setDateRangeFilter("all");
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, eventTypeFilter, statusFilter, dateRangeFilter]);

  const logs = data?.logs || [];
  const totalLogs = data?.pagination.totalCount || 0;
  const loading = isLoading;

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
        onClearFilters={handleClearFilters}
        onRefresh={handleReload}
        isLoading={isLoading}
        allowedEventTypes={SECURITY_EVENT_TYPES}
        exportFilters={{
          search: searchQuery || undefined,
          eventType:
            eventTypeFilter !== "all" ? (eventTypeFilter as SecurityEventType) : undefined,
          eventTypes: eventTypeFilter === "all" ? SECURITY_EVENT_TYPES : undefined,
          dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
        }}
      />

      {error && (
        <div className="text-center py-8 text-destructive">
          Error loading security logs:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      <AccessLogsTable
        logs={logs.map((log) => ({
          ...log,
          created_at: new Date(log.created_at),
          success: true,
          portal: null,
          device_type: null,
          cognito_event: null,
        }))}
        loading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalLogs={totalLogs}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
