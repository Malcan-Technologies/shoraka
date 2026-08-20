"use client";

import type { Activity, ActivityDomain, ActivityPortal } from "@cashsouk/types";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { Skeleton } from "./skeleton";
import { ActivityItem } from "./activity-item";
import { ActivityToolbar } from "./activity-toolbar";

interface ActivityFeedProps {
  portal: ActivityPortal;
  activities: Activity[];
  isLoading: boolean;
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
  onReload: () => void;
  hasActiveFilters: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function ActivityFeed({
  portal,
  activities,
  isLoading,
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
  hasActiveFilters,
  page,
  pageSize,
  onPageChange,
}: ActivityFeedProps) {
  return (
    <div className="space-y-6">
      <ActivityToolbar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        availableDomains={availableDomains}
        domainFilters={domainFilters}
        defaultDomains={defaultDomains}
        onDomainFiltersChange={onDomainFiltersChange}
        dateRangeFilter={dateRangeFilter}
        onDateRangeFilterChange={onDateRangeFilterChange}
        totalCount={totalCount}
        filteredCount={filteredCount}
        onClearFilters={onClearFilters}
        onReload={onReload}
        isLoading={isLoading}
      />

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="hidden grid-cols-[minmax(0,1fr)_20rem] gap-8 border-b bg-muted/30 px-6 py-3 text-ui font-medium text-muted-foreground sm:grid">
          <div>Activity</div>
          <div className="grid grid-cols-[8.5rem_10rem] gap-6">
            <div>Status</div>
            <div className="text-right">Time</div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between px-6 py-4">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-[200px]" />
                  <Skeleton className="h-4 w-[300px]" />
                </div>
                <div className="flex items-center gap-12">
                  <Skeleton className="h-6 w-[100px] rounded-full" />
                  <Skeleton className="h-4 w-[140px]" />
                </div>
              </div>
            ))
          ) : activities.length > 0 ? (
            activities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                portal={portal}
                className="px-6"
              />
            ))
          ) : (
            <EmptyState
              variant={hasActiveFilters ? "no-results" : "no-data"}
              title={hasActiveFilters ? "No matching activity" : "No activity yet"}
              message={
                hasActiveFilters
                  ? "Try a different search or clear your filters."
                  : "Milestones from your organisation will show up here."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" onClick={onClearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
              className="border-0 py-12 shadow-none"
            />
          )}
        </div>

        {filteredCount > 0 ? (
          <div className="border-t bg-card px-6 py-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredCount}
              onPageChange={onPageChange}
              itemLabel="activities"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
