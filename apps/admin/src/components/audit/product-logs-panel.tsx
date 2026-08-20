"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListToolbar, ListToolbarFilterTrigger, type FilterChip } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductLogs, useExportProductLogs } from "@/hooks/use-product-logs";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import { AuditLogDetailSheet } from "@/components/audit/audit-log-detail-sheet";
import { formatAuditEventLabel } from "@/lib/audit-tabs";
import { formatAuditDateTime } from "@/lib/audit-datetime";
import {
  auditExportFilename,
  downloadAuditExport,
  truncatedExportDescription,
} from "@/lib/download-audit-export";
import { toast } from "sonner";
import type { ProductLogResponse } from "@cashsouk/types";
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import type { ProductEventType, GetProductLogsParams } from "@cashsouk/types";
import { DATE_RANGES } from "@cashsouk/config";

const PRODUCT_EVENT_TYPES: { value: ProductEventType; label: string; color: string }[] = [
  { value: "PRODUCT_CREATED", label: "Created", color: "bg-green-500" },
  { value: "PRODUCT_UPDATED", label: "Updated", color: "bg-blue-500" },
  { value: "PRODUCT_INACTIVATED", label: "Inactivated", color: "bg-amber-500" },
  { value: "PRODUCT_REACTIVATED", label: "Reactivated", color: "bg-violet-500" },
  { value: "PRODUCT_DELETED", label: "Deleted", color: "bg-red-500" },
];

function formatDate(dateStr: string): string {
  return formatAuditDateTime(dateStr);
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

export function ProductLogsPanel() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = React.useState<string>("all");
  const [selectedLog, setSelectedLog] = React.useState<ProductLogResponse | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

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
    searchQuery !== "" || eventTypeFilter !== "all" || dateRangeFilter !== "all";

  const appliedFilters: FilterChip[] = [];
  if (eventTypeFilter !== "all") {
    appliedFilters.push({
      id: "event",
      label: `Event: ${
        PRODUCT_EVENT_TYPES.find((type) => type.value === eventTypeFilter)?.label ?? eventTypeFilter
      }`,
      onRemove: () => setEventTypeFilter("all"),
    });
  }
  if (dateRangeFilter !== "all") {
    appliedFilters.push({
      id: "date",
      label: DATE_RANGES.find((range) => range.value === dateRangeFilter)?.label ?? dateRangeFilter,
      onRemove: () => setDateRangeFilter("all"),
    });
  }

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
      const result = await getExportLogs({
        search: searchQuery || undefined,
        eventType:
          eventTypeFilter !== "all" ? (eventTypeFilter as ProductEventType) : undefined,
        dateRange: dateRangeFilter as "24h" | "7d" | "30d" | "all",
        format,
      });
      downloadAuditExport(result.blob, auditExportFilename("product-logs", format));
      if (result.truncated) {
        toast.warning("Export truncated", { description: truncatedExportDescription() });
      } else {
        toast.success(`Product logs exported as ${format.toUpperCase()}`);
      }
    } catch (error) {
      toast.error("Failed to export product logs", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, eventTypeFilter, dateRangeFilter]);

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="product logs" />;
  }

  return (
    <div className="space-y-6">
      <ListToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by admin name or email..."
        appliedFilters={appliedFilters}
        onClearFilters={hasFilters ? handleClearFilters : undefined}
        onReload={handleReload}
        isLoading={isLoading}
        countLabel={`${totalCount} ${totalCount === 1 ? "log" : "logs"}`}
        filterGroups={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ListToolbarFilterTrigger
                label="Filters"
                count={[eventTypeFilter !== "all", dateRangeFilter !== "all"].filter(Boolean).length}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Event type</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <DropdownMenuRadioItem value="all">All events</DropdownMenuRadioItem>
                {PRODUCT_EVENT_TYPES.map((type) => (
                  <DropdownMenuRadioItem key={type.value} value={type.value}>
                    {type.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Date range</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                {DATE_RANGES.map((range) => (
                  <DropdownMenuRadioItem key={range.value} value={range.value}>
                    {range.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 rounded-xl bg-card">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("csv")}>Export as CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("json")}>Export as JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ListToolbar>

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
              <TableHead className="text-right">Details</TableHead>
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
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <CubeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No product logs found</p>
                  <p className="text-sm mt-1">Product changes will be recorded here</p>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const metadata = log.metadata ?? {};
                const productName =
                  typeof metadata.productName === "string" ? metadata.productName : "";
                const productId = log.productId;
                const actorName = log.actor.displayName || log.actor.userId || "—";
                const actorEmail = log.actor.email || "";

                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(log.occurredAt)}
                    </TableCell>
                    <TableCell className="text-sm min-w-[180px] max-w-[280px]">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" title={actorName}>
                          {actorName}
                        </p>
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={actorEmail || undefined}
                        >
                          {actorEmail || "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getEventTypeBadge(log.eventType)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="max-w-[250px] min-w-[140px]">
                        <p
                          className="font-medium text-sm truncate"
                          title={productName || undefined}
                        >
                          {productName || "—"}
                        </p>
                        {productId && (
                          <p
                            className="text-xs text-muted-foreground truncate"
                            title={productId}
                          >
                            ID: {productId}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ipAddress || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {log.deviceInfo || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailOpen(true);
                        }}
                      >
                        <EyeIcon className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

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

      <AuditLogDetailSheet
        log={
          selectedLog
            ? {
                id: selectedLog.id,
                eventType: selectedLog.eventType,
                eventLabel: formatAuditEventLabel(selectedLog.eventType),
                occurredAt: selectedLog.occurredAt,
                createdAt: selectedLog.createdAt,
                actorType: selectedLog.actor.type,
                actorName: selectedLog.actor.displayName ?? null,
                actorEmail: selectedLog.actor.email ?? null,
                actorUserId: selectedLog.actor.userId,
                targetType: selectedLog.target.type,
                targetId: selectedLog.target.id,
                source: selectedLog.source,
                portal: selectedLog.portal,
                ipAddress: selectedLog.ipAddress,
                userAgent: selectedLog.userAgent,
                deviceInfo: selectedLog.deviceInfo,
                correlationId: selectedLog.correlationId,
                extraFields: [{ label: "Product ID", value: selectedLog.productId }],
                metadata: selectedLog.metadata,
              }
            : null
        }
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Product audit"
        description="Read-only product configuration change record."
      />
    </div>
  );
}
