"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AccessLogsTable } from "@/components/access-logs-table";
import { AccessLogsToolbar } from "@/components/access-logs-toolbar";
import { OnboardingLogsExportButton } from "@/components/onboarding-logs-export-button";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import { Input } from "@/components/ui/input";
import { useOnboardingLogs } from "@/hooks/use-onboarding-logs";
import { formatAuditEventLabel } from "@/lib/audit-tabs";
import {
  ONBOARDING_AUDIT_EVENTS,
  type GetOnboardingLogsParams,
  type OnboardingEventType,
} from "@cashsouk/types";

const ONBOARDING_EVENT_OPTIONS = ONBOARDING_AUDIT_EVENTS.map((value) => ({
  value,
  label: formatAuditEventLabel(value),
}));

export function OnboardingLogsPanel() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dateRangeFilter, setDateRangeFilter] = React.useState("all");
  const [organizationId, setOrganizationId] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 15;

  const apiParams = React.useMemo(() => {
    const params: GetOnboardingLogsParams = {
      page: currentPage,
      pageSize,
      dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
    };
    if (searchQuery) params.search = searchQuery;
    if (eventTypeFilter !== "all") params.eventType = eventTypeFilter as OnboardingEventType;
    if (organizationId.trim()) params.organizationId = organizationId.trim();
    return params;
  }, [currentPage, pageSize, searchQuery, eventTypeFilter, dateRangeFilter, organizationId]);

  const { data, isLoading, error } = useOnboardingLogs(apiParams);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, eventTypeFilter, dateRangeFilter, organizationId]);

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="onboarding audit" />;
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
          setOrganizationId("");
          setCurrentPage(1);
        }}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-logs"] })}
        isLoading={isLoading}
        eventTypeOptions={ONBOARDING_EVENT_OPTIONS}
        showStatusFilter={false}
        exportKind="access"
        exportFilters={{}}
        hideExport
        exportButton={
          <OnboardingLogsExportButton
            filters={{
              search: searchQuery || undefined,
              eventType:
                eventTypeFilter !== "all" ? (eventTypeFilter as OnboardingEventType) : undefined,
              dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
              organizationId: organizationId.trim() || undefined,
            }}
          />
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          placeholder="Organization ID"
          aria-label="Organization ID"
          className="h-10 max-w-xs"
        />
      </div>
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
          organizationType: log.organizationType,
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
        emptyLabel="No onboarding audit records found"
      />
    </div>
  );
}
