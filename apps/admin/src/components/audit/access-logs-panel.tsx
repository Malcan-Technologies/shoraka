"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AccessLogsTable } from "@/components/access-logs-table";
import { AccessLogsToolbar } from "@/components/access-logs-toolbar";
import { ACCESS_EVENT_TYPES, useAccessLogs } from "@/hooks/use-access-logs";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import type { EventType, GetAccessLogsParams } from "@cashsouk/types";

export { ACCESS_EVENT_TYPES };

// access_logs.PROFILE_UPDATED (an admin editing a user's own profile fields) collides with the
// unrelated security_logs.PROFILE_UPDATED (self-service profile update) in the shared event-type
// label config; disambiguated here so only this panel shows the access_logs-specific wording.
const ACCESS_LOG_LABEL_OVERRIDES: Record<string, string> = {
  PROFILE_UPDATED: "User Profile Updated",
};

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

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (eventTypeFilter !== "all") {
      params.eventType = eventTypeFilter as EventType;
    }

    if (statusFilter !== "all") {
      params.status = statusFilter as "success" | "failed";
    }

    return params;
  }, [currentPage, pageSize, searchQuery, eventTypeFilter, statusFilter, dateRangeFilter]);

  const { data, isLoading, error } = useAccessLogs({
    ...apiParams,
    allowedEventTypes: ACCESS_EVENT_TYPES,
  });

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "access-logs"] });
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

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="access logs" />;
  }

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
        allowedEventTypes={ACCESS_EVENT_TYPES}
        exportFilters={{
          search: searchQuery || undefined,
          eventType: eventTypeFilter !== "all" ? (eventTypeFilter as EventType) : undefined,
          eventTypes: eventTypeFilter === "all" ? ACCESS_EVENT_TYPES : undefined,
          status: statusFilter !== "all" ? (statusFilter as "success" | "failed") : undefined,
          dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
        }}
      />

      <AccessLogsTable
        logs={logs.map((log) => ({
          ...log,
          created_at: new Date(log.created_at),
        }))}
        loading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalLogs={totalLogs}
        onPageChange={setCurrentPage}
        labelOverrides={ACCESS_LOG_LABEL_OVERRIDES}
      />
    </div>
  );
}
