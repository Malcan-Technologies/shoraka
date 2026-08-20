"use client";

import * as React from "react";
import { ListToolbar, ListToolbarFilterTrigger, type FilterChip } from "@cashsouk/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AccessLogsExportButton } from "./access-logs-export-button";
import type { ExportAccessLogsParams, ExportSecurityLogsParams } from "@cashsouk/types";

const DATE_LABELS: Record<string, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

const STATUS_LABELS: Record<string, string> = {
  success: "Success",
  failed: "Failed",
};

interface AccessLogsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  eventTypeFilter: string;
  onEventTypeFilterChange: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  dateRangeFilter: string;
  onDateRangeFilterChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  exportKind: "access" | "security";
  exportFilters?: Omit<ExportAccessLogsParams, "format" | "page" | "pageSize"> | Omit<
    ExportSecurityLogsParams,
    "format" | "page" | "pageSize"
  >;
  onRefresh?: () => void;
  isLoading?: boolean;
  eventTypeOptions: { value: string; label: string }[];
  showStatusFilter?: boolean;
  hideExport?: boolean;
  exportButton?: React.ReactNode;
}

export function AccessLogsToolbar({
  searchQuery,
  onSearchChange,
  eventTypeFilter,
  onEventTypeFilterChange,
  statusFilter = "all",
  onStatusFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  totalCount,
  filteredCount,
  onClearFilters,
  exportKind,
  exportFilters,
  onRefresh,
  isLoading = false,
  eventTypeOptions,
  showStatusFilter = false,
  hideExport = false,
  exportButton,
}: AccessLogsToolbarProps) {
  const statusActive = showStatusFilter && statusFilter !== "all";
  const hasFilters =
    Boolean(searchQuery) ||
    eventTypeFilter !== "all" ||
    statusActive ||
    dateRangeFilter !== "all";

  const activeFilterCount = [
    eventTypeFilter !== "all",
    statusActive,
    dateRangeFilter !== "all",
  ].filter(Boolean).length;

  const appliedFilters: FilterChip[] = [];
  if (eventTypeFilter !== "all") {
    appliedFilters.push({
      id: "event",
      label: `Event: ${
        eventTypeOptions.find((opt) => opt.value === eventTypeFilter)?.label ?? eventTypeFilter
      }`,
      onRemove: () => onEventTypeFilterChange("all"),
    });
  }
  if (statusActive) {
    appliedFilters.push({
      id: "status",
      label: `Status: ${STATUS_LABELS[statusFilter] ?? statusFilter}`,
      onRemove: () => onStatusFilterChange?.("all"),
    });
  }
  if (dateRangeFilter !== "all") {
    appliedFilters.push({
      id: "date",
      label: DATE_LABELS[dateRangeFilter] ?? dateRangeFilter,
      onRemove: () => onDateRangeFilterChange("all"),
    });
  }

  return (
    <ListToolbar
      searchValue={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by name or email"
      appliedFilters={appliedFilters}
      onClearFilters={hasFilters ? onClearFilters : undefined}
      onReload={onRefresh}
      isLoading={isLoading}
      countLabel={`${filteredCount} ${filteredCount === 1 ? "log" : "logs"}${
        hasFilters ? ` of ${totalCount}` : ""
      }`}
      filterGroups={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ListToolbarFilterTrigger label="Filters" count={activeFilterCount} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Event type</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={eventTypeFilter} onValueChange={onEventTypeFilterChange}>
              <DropdownMenuRadioItem value="all">All events</DropdownMenuRadioItem>
              {eventTypeOptions.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {showStatusFilter ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => onStatusFilterChange?.(value)}
                >
                  <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="success">Success</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="failed">Failed</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Date range</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={dateRangeFilter} onValueChange={onDateRangeFilterChange}>
              <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="24h">Last 24 hours</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="7d">Last 7 days</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="30d">Last 30 days</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {exportButton
        ? exportButton
        : !hideExport && exportFilters
          ? <AccessLogsExportButton kind={exportKind} filters={exportFilters} />
          : null}
    </ListToolbar>
  );
}
