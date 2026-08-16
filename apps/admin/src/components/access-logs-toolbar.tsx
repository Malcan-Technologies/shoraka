"use client";

import * as React from "react";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { AccessLogsExportButton } from "./access-logs-export-button";
import type { ExportAccessLogsParams, ExportSecurityLogsParams } from "@cashsouk/types";

interface AccessLogsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  eventTypeFilter: string;
  onEventTypeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
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
  statusFilter,
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
  const [isSpinning, setIsSpinning] = React.useState(false);

  const hasFilters =
    Boolean(searchQuery) ||
    eventTypeFilter !== "all" ||
    statusFilter !== "all" ||
    dateRangeFilter !== "all";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or email"
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {hasFilters && (
          <Badge variant="secondary" className="font-normal">
            {filteredCount} of {totalCount}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FunnelIcon className="h-4 w-4" />
              Event
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Event type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={eventTypeFilter} onValueChange={onEventTypeFilterChange}>
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              {eventTypeOptions.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {showStatusFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Status</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={onStatusFilterChange}>
                <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="success">Success</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="failed">Failed</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Date</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={dateRangeFilter} onValueChange={onDateRangeFilterChange}>
              <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="24h">Last 24 hours</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="7d">Last 7 days</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="30d">Last 30 days</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1">
            <XMarkIcon className="h-4 w-4" />
            Clear
          </Button>
        )}
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsSpinning(true);
              onRefresh();
              window.setTimeout(() => setIsSpinning(false), 500);
            }}
            disabled={isLoading}
          >
            <ArrowPathIcon className={`h-4 w-4 ${isSpinning ? "animate-spin" : ""}`} />
          </Button>
        )}
        {exportButton
          ? exportButton
          : !hideExport && exportFilters
            ? <AccessLogsExportButton kind={exportKind} filters={exportFilters} />
            : null}
      </div>
    </div>
  );
}
