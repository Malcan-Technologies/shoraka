"use client";

import { useState, useEffect } from "react";
import { useActivities } from "../../hooks/use-activities";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ActivityItem, Badge, Skeleton, ActivityToolbar } from "@cashsouk/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Header } from "@/components/header";

export default function ActivityPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [eventTypes, dateRange]);

  const { data, isLoading, refetch } = useActivities({
    page,
    limit,
    search: debouncedSearch || undefined,
    eventTypes: eventTypes.length > 0 ? eventTypes : undefined,
    dateRange: dateRange !== "all" ? (dateRange as any) : undefined,
  });

  const activities = data?.activities || [];
  const pagination = data?.pagination;

  const handleClearFilters = () => {
    setSearch("");
    setEventTypes([]);
    setDateRange("all");
    setPage(1);
  };

  return (
    <>
      <Header title="Dashboard" />

      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 px-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl font-bold">Activities</CardTitle>
              {pagination && (
                <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground font-normal hover:bg-muted">
                  {pagination.total}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            <ActivityToolbar
              searchQuery={search}
              onSearchChange={setSearch}
              eventTypeFilters={eventTypes}
              onEventTypeFiltersChange={setEventTypes}
              dateRangeFilter={dateRange}
              onDateRangeFilterChange={setDateRange}
              totalCount={pagination?.unfilteredTotal || 0}
              filteredCount={pagination?.total || 0}
              onClearFilters={handleClearFilters}
              onReload={() => refetch()}
              isLoading={isLoading}
            />

            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="grid grid-cols-[1fr_400px] gap-12 px-6 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
                <div className="flex-1">Activity</div>
                <div className="flex items-center gap-12">
                  <div className="w-[120px]">Event</div>
                  <div className="min-w-[160px] text-right">Time</div>
                </div>
              </div>

              <div className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-4 px-6">
                      <div className="flex flex-col gap-2 flex-1">
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
                    <ActivityItem key={activity.id} activity={activity} className="px-6 hover:bg-muted/20" />
                  ))
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    {search ? "No activities found matching your search." : "No activities recorded yet."}
                  </div>
                )}
              </div>

              {pagination && pagination.total > 0 && (
                <div className="flex items-center justify-between border-t px-6 py-4 bg-white">
                  <div className="text-sm text-muted-foreground">
                    Showing {Math.min((page - 1) * limit + 1, pagination.total)}-{Math.min(page * limit, pagination.total)} of {pagination.total}
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
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
