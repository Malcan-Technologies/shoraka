"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "../../../components/ui/sidebar";
import { Separator } from "../../../components/ui/separator";
import { SystemHealthIndicator } from "../../../components/system-health-indicator";
import { AccessLogsTable } from "../../../components/access-logs-table";
import { OnboardingLogsExportButton } from "../../../components/onboarding-logs-export-button";
import { useOnboardingLogs } from "../../../hooks/use-onboarding-logs";
import type {
  OnboardingEventType,
  GetOnboardingLogsParams,
  UserRole,
  EventType,
} from "@cashsouk/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const ONBOARDING_EVENT_TYPES: OnboardingEventType[] = [
  "ONBOARDING_STARTED",
  "ONBOARDING_RESUMED",
  "ONBOARDING_STATUS_UPDATED",
  "ONBOARDING_CANCELLED",
  "ONBOARDING_REJECTED",
  "SOPHISTICATED_STATUS_UPDATED",
  "FINAL_APPROVAL_COMPLETED",
  "FORM_FILLED",
  "ONBOARDING_APPROVED",
  "AML_APPROVED",
  "TNC_APPROVED",
  "SSM_APPROVED",
  "TNC_ACCEPTED",
];

const EVENT_TYPE_OPTIONS: { value: OnboardingEventType; label: string }[] = [
  { value: "ONBOARDING_STARTED", label: "Onboarding Started" },
  { value: "ONBOARDING_RESUMED", label: "Onboarding Resumed" },
  { value: "ONBOARDING_STATUS_UPDATED", label: "Onboarding Status Updated" },
  { value: "ONBOARDING_CANCELLED", label: "Onboarding Cancelled" },
  { value: "ONBOARDING_REJECTED", label: "Onboarding Rejected" },
  { value: "SOPHISTICATED_STATUS_UPDATED", label: "Sophisticated Status Updated" },
  { value: "FINAL_APPROVAL_COMPLETED", label: "Final Approval Completed" },
  { value: "FORM_FILLED", label: "Form Filled" },
  { value: "ONBOARDING_APPROVED", label: "Onboarding Approved" },
  { value: "AML_APPROVED", label: "AML Approved" },
  { value: "TNC_APPROVED", label: "T&C Approved" },
  { value: "SSM_APPROVED", label: "SSM Approved" },
  { value: "TNC_ACCEPTED", label: "T&C Accepted" },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "INVESTOR", label: "Investor" },
  { value: "ISSUER", label: "Issuer" },
];

export default function OnboardingLogsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState("all");
  const [roleFilter, setRoleFilter] = React.useState<UserRole | "all">("all");
  const [dateRangeFilter, setDateRangeFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 15;

  const apiParams = React.useMemo(() => {
    const params: GetOnboardingLogsParams = {
      page: currentPage,
      pageSize,
      dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
    };

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (eventTypeFilter !== "all") {
      params.eventType = eventTypeFilter as OnboardingEventType;
    }

    if (roleFilter !== "all") {
      params.role = roleFilter;
    }

    return params;
  }, [currentPage, pageSize, searchQuery, eventTypeFilter, roleFilter, dateRangeFilter]);

  const { data, isLoading, error } = useOnboardingLogs({
    ...apiParams,
    allowedEventTypes: ONBOARDING_EVENT_TYPES,
  });

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-logs"] });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setEventTypeFilter("all");
    setRoleFilter("all");
    setDateRangeFilter("all");
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, eventTypeFilter, roleFilter, dateRangeFilter]);

  const logs = data?.logs || [];
  const totalLogs = data?.pagination.totalCount || 0;
  const loading = isLoading;

  const hasFilters =
    searchQuery !== "" ||
    eventTypeFilter !== "all" ||
    roleFilter !== "all" ||
    dateRangeFilter !== "all";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Onboarding Logs</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Custom Toolbar with Role Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 rounded-xl"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Event Type
                  {eventTypeFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Event Type</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <DropdownMenuRadioItem value="all">All Events</DropdownMenuRadioItem>
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Role
                  {roleFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Role</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={roleFilter}
                  onValueChange={(value) => setRoleFilter(value as UserRole | "all")}
                >
                  <DropdownMenuRadioItem value="all">All Roles</DropdownMenuRadioItem>
                  {ROLE_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Date Range
                  {dateRangeFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                  <DropdownMenuRadioItem value="all">All Time</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="24h">Last 24 Hours</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="7d">Last 7 Days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30d">Last 30 Days</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasFilters && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="gap-2 h-11 rounded-xl"
              >
                <XMarkIcon className="h-4 w-4" />
                Clear
              </Button>
            )}

            {handleReload && (
              <Button
                variant="outline"
                onClick={handleReload}
                disabled={isLoading}
                className="gap-2 h-11 rounded-xl"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Reload
              </Button>
            )}

            <OnboardingLogsExportButton
              filters={{
                search: searchQuery || undefined,
                eventType:
                  eventTypeFilter !== "all" ? (eventTypeFilter as OnboardingEventType) : undefined,
                eventTypes: eventTypeFilter === "all" ? ONBOARDING_EVENT_TYPES : undefined,
                role: roleFilter !== "all" ? roleFilter : undefined,
                dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
              }}
            />

            <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm">
              {totalLogs} {totalLogs === 1 ? "log" : "logs"}
              {hasFilters && ` of ${totalLogs}`}
            </Badge>
          </div>

          {error && (
            <div className="text-center py-8 text-destructive">
              Error loading onboarding logs:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          <AccessLogsTable
            logs={logs.map((log) => ({
              id: log.id,
              user_id: log.user_id,
              user: log.user,
              event_type: log.event_type as EventType,
              role: log.role,
              portal: log.portal,
              ip_address: log.ip_address,
              user_agent: log.user_agent,
              device_info: log.device_info,
              device_type: log.device_type,
              cognito_event: null,
              success: true,
              metadata: log.metadata,
              created_at: new Date(log.created_at),
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
