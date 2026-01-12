"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "../../../components/ui/sidebar";
import { Separator } from "../../../components/ui/separator";
import { SystemHealthIndicator } from "../../../components/system-health-indicator";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from "../../../components/ui/dropdown-menu";
import { Skeleton } from "../../../components/ui/skeleton";
import { useProductLogs, useExportProductLogs } from "../../../hooks/use-product-logs";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import type { ProductEventType, GetProductLogsParams } from "@cashsouk/types";

const PRODUCT_EVENT_TYPES: { value: ProductEventType; label: string; color: string }[] = [
  { value: "PRODUCT_CREATED", label: "Created", color: "bg-green-500" },
  { value: "PRODUCT_UPDATED", label: "Updated", color: "bg-blue-500" },
  { value: "PRODUCT_DELETED", label: "Deleted", color: "bg-red-500" },
];

const DATE_RANGES = [
  { value: "all", label: "All Time" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventTypeBadge(eventType: ProductEventType) {
  const type = PRODUCT_EVENT_TYPES.find((t) => t.value === eventType);
  if (!type) return <Badge variant="outline">{eventType}</Badge>;

  return (
    <Badge
      variant="outline"
      className={`${type.color} bg-opacity-10 border-opacity-30`}
      style={{
        backgroundColor: `color-mix(in srgb, ${type.color.replace("bg-", "")} 10%, transparent)`,
      }}
    >
      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${type.color}`} />
      {type.label}
    </Badge>
  );
}

const ITEMS_PER_PAGE = 15;

export default function ProductLogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = React.useState<string>("all");

  const getExportLogs = useExportProductLogs();

  const apiParams = React.useMemo(() => {
    const params: GetProductLogsParams = {
      page,
      pageSize: ITEMS_PER_PAGE,
      dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
    };

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (eventTypeFilter !== "all") {
      params.eventType = eventTypeFilter as ProductEventType;
    }

    return params;
  }, [page, searchQuery, eventTypeFilter, dateRangeFilter]);

  const { data, isLoading, error } = useProductLogs(apiParams);

  const logs = data?.logs || [];
  const totalCount = data?.pagination.totalCount || 0;
  const totalPages = data?.pagination.totalPages || 0;

  const hasFilters =
    searchQuery !== "" ||
    eventTypeFilter !== "all" ||
    dateRangeFilter !== "all";

  const handleClearFilters = () => {
    setSearchQuery("");
    setEventTypeFilter("all");
    setDateRangeFilter("all");
    setPage(1);
  };

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "product-logs"] });
  };

  const handleExport = async (format: "csv" | "json") => {
    try {
      const blob = await getExportLogs({
        search: searchQuery || undefined,
        eventType: eventTypeFilter !== "all" ? (eventTypeFilter as ProductEventType) : undefined,
        dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
        format,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `product-logs-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, eventTypeFilter, dateRangeFilter]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Products Log</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by admin name or email..."
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
                  {PRODUCT_EVENT_TYPES.map((type) => (
                    <DropdownMenuRadioItem key={type.value} value={type.value}>
                      {type.label}
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
                  {DATE_RANGES.map((range) => (
                    <DropdownMenuRadioItem key={range.value} value={range.value}>
                      {range.label}
                    </DropdownMenuRadioItem>
                  ))}
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

            <Button
              variant="outline"
              onClick={handleReload}
              disabled={isLoading}
              className="gap-2 h-11 rounded-xl"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Reload
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm">
              {totalCount} {totalCount === 1 ? "log" : "logs"}
            </Badge>
          </div>

          {error && (
            <div className="text-center py-8 text-destructive">
              Error loading product logs:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          {/* Logs Table */}
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="min-w-[180px] max-w-[280px]">Admin</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <CubeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No product logs found</p>
                      <p className="text-sm mt-1">
                        Product changes will be recorded here
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const metadata = log.metadata as Record<string, unknown> | null;
                    const productName = (metadata?.name as string) || (metadata?.title as string) || "—";
                    const productId = log.product_id || "—";

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell className="text-sm min-w-[180px] max-w-[280px]">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate" title={`${log.user.first_name} ${log.user.last_name}`}>
                              {log.user.first_name} {log.user.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate" title={log.user.email}>
                              {log.user.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getEventTypeBadge(log.event_type)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="max-w-[250px]">
                            <p className="font-medium text-sm truncate">{productName}</p>
                            {productId !== "—" && (
                              <p className="text-xs text-muted-foreground">
                                ID: {productId}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.ip_address || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {log.device_info || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({totalCount} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeftIcon className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
