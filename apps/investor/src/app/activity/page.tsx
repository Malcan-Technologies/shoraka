"use client";

import { useState, useEffect } from "react";
import { useActivities } from "../../hooks/use-activities";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ActivityItem, Badge, Skeleton } from "@cashsouk/ui";
import { MagnifyingGlassIcon, FunnelIcon } from "@heroicons/react/24/outline";

export default function ActivityPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useActivities({
    page,
    limit,
    search: debouncedSearch || undefined,
  });

  const activities = data?.activities || [];
  const pagination = data?.pagination;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </header>

      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 px-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl font-bold">Activities</CardTitle>
              {pagination && (
                <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground font-normal">
                  {pagination.total}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-9 bg-white border-border"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                />
              </div>
              <Button variant="outline" className="gap-2 bg-white border-border">
                <FunnelIcon className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {page} of {pagination.pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
