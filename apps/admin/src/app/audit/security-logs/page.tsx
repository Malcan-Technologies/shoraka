"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "../../../components/ui/sidebar";
import { Separator } from "../../../components/ui/separator";
import { SystemHealthIndicator } from "../../../components/system-health-indicator";
import { AccessLogsTable } from "../../../components/access-logs-table";
import { AccessLogsToolbar } from "../../../components/access-logs-toolbar";
import { useSecurityLogs } from "../../../hooks/use-security-logs";
import type { SecurityEventType, GetSecurityLogsParams } from "@cashsouk/types";

// Security-related event types
const SECURITY_EVENT_TYPES: SecurityEventType[] = [
  "PASSWORD_CHANGED",
  "EMAIL_CHANGED",
  "ROLE_ADDED",
  "ROLE_SWITCHED",
  "PROFILE_UPDATED",
];

export default function SecurityLogsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dateRangeFilter, setDateRangeFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 15;

  // Build API params from filters
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
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Security Logs</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
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
            onReload={handleReload}
            isLoading={isLoading}
            allowedEventTypes={SECURITY_EVENT_TYPES}
            exportFilters={{
              search: searchQuery || undefined,
              eventType: eventTypeFilter !== "all" ? (eventTypeFilter as SecurityEventType) : undefined,
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
              // SecurityLog doesn't have these fields, so we provide defaults
              success: true, // Security events are always successful (they're logged after the action)
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
      </div>
    </>
  );
}
