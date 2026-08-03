"use client";

import { useState, useEffect, useCallback } from "react";
import { getFilterableActivityDomains, type GetActivitiesParams } from "@cashsouk/types";
import { useActivities } from "@/hooks/use-activities";
import { Button } from "@/components/ui/button";
import {
  ActivityItem,
  EmptyState,
  PageShell,
  Skeleton,
  ActivityToolbar,
} from "@cashsouk/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

export function IssuerActivityList({ embedded = false }: { embedded?: boolean }) {
  const availableDomains = getFilterableActivityDomains("issuer");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [domains, setDomains] = useState<NonNullable<GetActivitiesParams["domains"]>>([]);
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 10;

  const apiDateRangeByUi: Record<string, GetActivitiesParams["dateRange"] | undefined> = {
    all: undefined,
    "24h": "24h",
    "7d": "7d",
    "30d": "30d",
  };

  const handleDomainsChange = useCallback((values: NonNullable<GetActivitiesParams["domains"]>) => {
    setDomains(values);
    setPage(1);
  }, []);

  const handleDateRangeChange = useCallback((value: string) => {
    setDateRange(value);
    setPage(1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch } = useActivities({
    page,
    limit,
    search: debouncedSearch || undefined,
    domains: domains.length > 0 ? domains : undefined,
    dateRange: apiDateRangeByUi[dateRange],
  });

  const activities = data?.activities || [];
  const pagination = data?.pagination;
  const hasActiveFilters =
    Boolean(debouncedSearch) || domains.length > 0 || dateRange !== "all";

  const handleClearFilters = () => {
    setSearch("");
    setDomains([]);
    setDateRange("all");
    setPage(1);
  };

  const body = (
    <div className="space-y-6">
      <ActivityToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        availableDomains={availableDomains}
        domainFilters={domains}
        onDomainFiltersChange={handleDomainsChange}
        dateRangeFilter={dateRange}
        onDateRangeFilterChange={handleDateRangeChange}
        totalCount={pagination?.unfilteredTotal || 0}
        filteredCount={pagination?.total || 0}
        onClearFilters={handleClearFilters}
        onReload={() => refetch()}
        isLoading={isLoading}
      />

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-8 border-b bg-muted/30 px-6 py-3 text-sm font-medium text-muted-foreground">
          <div className="flex-1">Activity</div>
          <div className="grid grid-cols-[120px_160px] gap-8">
            <div>Domain</div>
            <div className="text-right">Time</div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4">
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
                className="px-6 hover:bg-muted/20"
              />
            ))
          ) : (
            <EmptyState
              variant={hasActiveFilters ? "no-results" : "no-data"}
              title={hasActiveFilters ? "No matching activity" : "No activity yet"}
              message={
                hasActiveFilters
                  ? "Try a different search or clear your filters."
                  : "Events from your applications and financing will show up here."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" onClick={handleClearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
              className="border-0 py-12 shadow-none"
            />
          )}
        </div>

        {pagination && pagination.total > 0 ? (
          <div className="flex items-center justify-between border-t bg-card px-6 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {Math.min((page - 1) * limit + 1, pagination.total)}-
              {Math.min(page * limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium">
                Page {page} of {pagination.pages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <PageShell
      title="Activity"
      description="Recent events across your applications and financing."
    >
      {body}
    </PageShell>
  );
}
