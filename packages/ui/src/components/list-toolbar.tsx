"use client";

import * as React from "react";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { cn } from "../lib/utils";
import { Input } from "./input";
import { Button, type ButtonProps } from "./button";
import { Badge } from "./badge";
import { FilterChips, type FilterChip } from "./filter-chips";
import { mergeListToolbarFilterChips } from "./list-toolbar-chips";

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

/** Height and chrome for filter triggers next to ListToolbar search / Refresh. */
export const listToolbarControlClassName = "h-11 gap-2 rounded-xl bg-card";

/** Same height as filter/refresh controls; muted fill so it does not look clickable. */
export const listToolbarCountClassName =
  "pointer-events-none h-11 rounded-xl border-border bg-muted px-4 text-ui font-normal text-muted-foreground shadow-none";

export const listToolbarFilterCountBadgeClassName =
  "ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs text-primary-foreground shadow-none";

export type ListToolbarFilterTriggerProps = Omit<ButtonProps, "variant" | "size"> & {
  label: string;
  count?: number;
};

/** Shared filter button: funnel icon, label, and optional count badge. */
export const ListToolbarFilterTrigger = React.forwardRef<
  HTMLButtonElement,
  ListToolbarFilterTriggerProps
>(function ListToolbarFilterTrigger(
  { label, count = 0, className, type = "button", ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      type={type}
      variant="outline"
      className={cn(listToolbarControlClassName, className)}
      {...props}
    >
      <FunnelIcon className="h-4 w-4" aria-hidden />
      {label}
      {count > 0 ? (
        <Badge variant="secondary" className={listToolbarFilterCountBadgeClassName}>
          {count}
        </Badge>
      ) : null}
    </Button>
  );
});

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
  const chips = mergeListToolbarFilterChips({
    searchValue,
    onSearchClear: onSearchChange ? () => onSearchChange("") : undefined,
    appliedFilters,
  });
  const hasApplied = chips.length > 0;

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
              className={cn(
                listToolbarControlClassName,
                "w-11 p-0 sm:w-auto sm:px-3"
              )}
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
            <Badge variant="outline" className={listToolbarCountClassName}>
              {countLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      {hasApplied ? (
        <FilterChips
          chips={chips}
          onClearAll={onClearFilters}
          clearAllLabel={clearFiltersLabel}
        />
      ) : null}
    </div>
  );
}
