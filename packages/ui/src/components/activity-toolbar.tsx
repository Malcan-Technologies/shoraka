"use client";

import * as React from "react";
import {
  ACTIVITY_DOMAIN_CONFIG,
  sameActivityDomainSet,
  type ActivityDomain,
} from "@cashsouk/types";
import { ListToolbar, ListToolbarFilterTrigger } from "./list-toolbar";
import type { FilterChip } from "./filter-chips";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

interface ActivityToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  availableDomains: ActivityDomain[];
  domainFilters: ActivityDomain[];
  defaultDomains: ActivityDomain[];
  onDomainFiltersChange: (values: ActivityDomain[]) => void;
  dateRangeFilter: string;
  onDateRangeFilterChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  onReload?: () => void;
  isLoading?: boolean;
}

function FilterDot() {
  return (
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-foreground" />
    </span>
  );
}

export function ActivityToolbar({
  searchQuery,
  onSearchChange,
  availableDomains,
  domainFilters,
  defaultDomains,
  onDomainFiltersChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  totalCount,
  filteredCount,
  onClearFilters,
  onReload,
  isLoading = false,
}: ActivityToolbarProps) {
  const domainOptions = React.useMemo(
    () =>
      availableDomains.map((value) => ({
        value,
        label: ACTIVITY_DOMAIN_CONFIG[value].label,
      })),
    [availableDomains]
  );

  const isAllDomains = domainFilters.length === 0;
  const domainsAreDefault = sameActivityDomainSet(domainFilters, defaultDomains);
  const dateLabel = DATE_RANGES.find((range) => range.value === dateRangeFilter)?.label;
  const hasFilters =
    searchQuery !== "" || !domainsAreDefault || dateRangeFilter !== "all";

  const appliedFilters = React.useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (!domainsAreDefault) {
      if (isAllDomains) {
        chips.push({
          id: "domains-all",
          label: "All areas",
          onRemove: () => onDomainFiltersChange(defaultDomains),
        });
      } else {
        for (const domain of domainFilters) {
          chips.push({
            id: `domain-${domain}`,
            label: ACTIVITY_DOMAIN_CONFIG[domain].label,
            onRemove: () =>
              onDomainFiltersChange(domainFilters.filter((value) => value !== domain)),
          });
        }
      }
    }
    if (dateRangeFilter !== "all" && dateLabel) {
      chips.push({
        id: "date",
        label: dateLabel,
        onRemove: () => onDateRangeFilterChange("all"),
      });
    }
    return chips;
  }, [
    dateLabel,
    dateRangeFilter,
    defaultDomains,
    domainFilters,
    domainsAreDefault,
    isAllDomains,
    onDateRangeFilterChange,
    onDomainFiltersChange,
  ]);

  const handleToggleDomain = (value: ActivityDomain | "all") => {
    if (value === "all") {
      onDomainFiltersChange([]);
      return;
    }

    const next = domainFilters.includes(value)
      ? domainFilters.filter((item) => item !== value)
      : [...domainFilters, value];
    onDomainFiltersChange(next);
  };

  const countLabel = hasFilters ? (
    <>
      {filteredCount} of {totalCount} {totalCount === 1 ? "activity" : "activities"}
    </>
  ) : (
    <>
      {totalCount} {totalCount === 1 ? "activity" : "activities"}
    </>
  );

  return (
    <ListToolbar
      searchValue={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by event or reference"
      appliedFilters={appliedFilters}
      onClearFilters={onClearFilters}
      onReload={onReload}
      isLoading={isLoading}
      countLabel={countLabel}
      filterGroups={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ListToolbarFilterTrigger
                label="Area"
                count={!domainsAreDefault && !isAllDomains ? domainFilters.length : 0}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1">
              <DropdownMenuLabel>Area</DropdownMenuLabel>
              <DropdownMenuItem className="relative pl-8" onClick={() => handleToggleDomain("all")}>
                {isAllDomains ? <FilterDot /> : null}
                All areas
              </DropdownMenuItem>
              {domainOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  className="relative pl-8"
                  onClick={() => handleToggleDomain(opt.value)}
                >
                  {domainFilters.includes(opt.value) ? <FilterDot /> : null}
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ListToolbarFilterTrigger
                label="Date"
                count={dateRangeFilter !== "all" ? 1 : 0}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1">
              <DropdownMenuLabel>Date</DropdownMenuLabel>
              {DATE_RANGES.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  className="relative pl-8"
                  onClick={() => onDateRangeFilterChange(opt.value)}
                >
                  {dateRangeFilter === opt.value ? <FilterDot /> : null}
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );
}
