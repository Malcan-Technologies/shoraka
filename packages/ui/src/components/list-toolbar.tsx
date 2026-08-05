"use client";

import * as React from "react";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { cn } from "../lib/utils";
import { Input } from "./input";
import { Button } from "./button";
import { Badge } from "./badge";
import { FilterChips, type FilterChip } from "./filter-chips";

export interface ListToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filterGroups?: React.ReactNode;
  appliedFilters?: FilterChip[];
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  onReload?: () => void;
  isLoading?: boolean;
  countLabel?: React.ReactNode;
}

export function ListToolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  filterGroups,
  appliedFilters = [],
  onClearFilters,
  clearFiltersLabel = "Clear all",
  onReload,
  isLoading = false,
  countLabel,
  className,
  children,
  ...props
}: ListToolbarProps) {
  const [isSpinning, setIsSpinning] = React.useState(false);
  const hasApplied = appliedFilters.length > 0;

  const handleReload = () => {
    setIsSpinning(true);
    onReload?.();
    window.setTimeout(() => setIsSpinning(false), 500);
  };

  return (
    <div className={cn("flex w-full flex-col gap-3", className)} {...props}>
      <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {onSearchChange ? (
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 rounded-xl bg-card pl-9"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {filterGroups}
          {children}
          {onReload ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleReload}
              disabled={isLoading || isSpinning}
              className="h-11 w-11 rounded-xl bg-card p-0 sm:w-auto sm:gap-2 sm:px-3"
              aria-label="Refresh"
            >
              <ArrowPathIcon
                className={cn(
                  "h-4 w-4",
                  (isLoading || isSpinning) && "animate-spin"
                )}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          ) : null}
          {countLabel != null ? (
            <Badge
              variant="outline"
              className="pointer-events-none h-auto px-3 py-1.5 text-sm font-normal text-muted-foreground"
            >
              {countLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      {hasApplied ? (
        <FilterChips
          chips={appliedFilters}
          onClearAll={onClearFilters}
          clearAllLabel={clearFiltersLabel}
        />
      ) : null}
    </div>
  );
}
