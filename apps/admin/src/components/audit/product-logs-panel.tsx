"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListToolbar, type FilterChip } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProductLogs, useExportProductLogs } from "@/hooks/use-product-logs";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import type { ProductEventType, GetProductLogsParams, ProductLogResponse } from "@cashsouk/types";
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { AuditEventBadge } from "@/components/audit/audit-event-badge";
import { AuditSourceBadge } from "@/components/audit/audit-source-badge";
import { productLogToAuditDetail } from "@/components/audit/audit-adapters";
import { formatAuditDateTime, formatAuditEventLabel } from "@/components/audit/audit-presentation";
import {
  AUDIT_DATE_RANGE_OPTIONS,
  AuditLogDateRangeOptions,
  AuditLogFilterOption,
  AuditLogFilterSection,
  AuditLogFilters,
} from "@/components/audit/audit-log-filters";
import { AuditLogActorCell } from "@/components/audit/audit-log-actor-cell";
import {
  AUDIT_IP_CELL_CLASS,
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_ROW_CLASS,
  AUDIT_TIMESTAMP_CELL_CLASS,
  AuditLogEmptyRow,
  AuditLogHead,
  AuditLogHeaderRow,
  AuditLogSkeletonRows,
  AuditLogTable,
  AuditLogTableShell,
  AuditLogViewDetailsButton,
  auditExportButtonClassName,
  auditRecordCountLabel,
} from "@/components/audit/audit-log-shell";

const PRODUCT_EVENT_TYPES: { value: ProductEventType; label: string }[] = [
  { value: "PRODUCT_CREATED", label: "Product Created" },
  { value: "PRODUCT_UPDATED", label: "Product Updated" },
  { value: "PRODUCT_DELETED", label: "Product Deleted" },
  { value: "PRODUCT_INACTIVATED", label: "Product Inactivated" },
  { value: "PRODUCT_REACTIVATED", label: "Product Reactivated" },
];

const COLUMN_COUNT = 7;

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
      pageSize: AUDIT_LOG_PAGE_SIZE,
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
      label:
        AUDIT_DATE_RANGE_OPTIONS.find((range) => range.value === dateRangeFilter)?.label ??
        dateRangeFilter,
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
      const blob = await getExportLogs({
        search: searchQuery || undefined,
        eventType:
          eventTypeFilter !== "all" ? (eventTypeFilter as ProductEventType) : undefined,
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

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="product logs" />;
  }

  return (
    <div className="space-y-6">
      <ListToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by product name, actor, email, or product ID..."
        appliedFilters={appliedFilters}
        onClearFilters={hasFilters ? handleClearFilters : undefined}
        onReload={handleReload}
        isLoading={isLoading}
        countLabel={auditRecordCountLabel(totalCount)}
        filterGroups={
          <AuditLogFilters
            activeCount={[eventTypeFilter !== "all", dateRangeFilter !== "all"].filter(Boolean).length}
          >
            <AuditLogFilterSection title="Event">
              <AuditLogFilterOption
                selected={eventTypeFilter === "all"}
                onSelect={() => setEventTypeFilter("all")}
              >
                All events
              </AuditLogFilterOption>
              {PRODUCT_EVENT_TYPES.map((type) => (
                <AuditLogFilterOption
                  key={type.value}
                  selected={eventTypeFilter === type.value}
                  onSelect={() => setEventTypeFilter(type.value)}
                >
                  {type.label}
                </AuditLogFilterOption>
              ))}
            </AuditLogFilterSection>
            <AuditLogDateRangeOptions value={dateRangeFilter} onChange={setDateRangeFilter} />
          </AuditLogFilters>
        }
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={totalCount === 0}
              className={auditExportButtonClassName()}
            >
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

      <AuditLogTableShell
        pagination={
          isLoading
            ? null
            : {
                currentPage: page,
                totalPages,
                pageSize: AUDIT_LOG_PAGE_SIZE,
                totalItems: totalCount,
                onPageChange: setPage,
              }
        }
      >
        <AuditLogTable>
          <AuditLogHeaderRow>
            <AuditLogHead>Timestamp</AuditLogHead>
            <AuditLogHead>Event</AuditLogHead>
            <AuditLogHead>Actor</AuditLogHead>
            <AuditLogHead>Product</AuditLogHead>
            <AuditLogHead>Source</AuditLogHead>
            <AuditLogHead>IP Address</AuditLogHead>
            <AuditLogHead align="right">Actions</AuditLogHead>
          </AuditLogHeaderRow>
          <TableBody>
            {isLoading ? (
              <AuditLogSkeletonRows columns={COLUMN_COUNT} />
            ) : logs.length === 0 ? (
              <AuditLogEmptyRow colSpan={COLUMN_COUNT} />
            ) : (
              logs.map((log) => {
                const metadata = log.metadata as Record<string, unknown> | null;
                const workflow = (metadata?.workflow as unknown[]) ?? [];
                const first = workflow[0] as
                  | { config?: { name?: string; type?: { name?: string } } }
                  | undefined;
                const productName =
                  (first?.config?.name as string) ||
                  (first?.config?.type?.name as string) ||
                  "";
                const productId = log.product_id ?? "";
                const eventLabel =
                  PRODUCT_EVENT_TYPES.find((type) => type.value === log.event_type)?.label ??
                  formatAuditEventLabel(log.event_type);
                const actorName = `${log.user.first_name} ${log.user.last_name}`.trim();
                const source = log.source || log.portal;

                return (
                  <TableRow
                    key={log.id}
                    className={AUDIT_ROW_CLASS}
                    onClick={() => {
                      setSelectedLog(log);
                      setDetailOpen(true);
                    }}
                  >
                    <TableCell className={AUDIT_TIMESTAMP_CELL_CLASS}>
                      {formatAuditDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <AuditEventBadge eventType={log.event_type} label={eventLabel} />
                    </TableCell>
                    <AuditLogActorCell
                      name={actorName}
                      email={log.user.email}
                      actorType={log.actor_type}
                    />
                    <TableCell className="text-ui">
                      <div className="min-w-[140px] max-w-[250px]">
                        <p className="truncate text-ui font-medium" title={productName || undefined}>
                          {productName || "—"}
                        </p>
                        {productId ? (
                          <p className="truncate text-meta text-muted-foreground" title={productId}>
                            {productId}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {source ? (
                        <AuditSourceBadge source={source} />
                      ) : (
                        <span className="text-ui text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={AUDIT_IP_CELL_CLASS}>{log.ip_address || "—"}</TableCell>
                    <TableCell className="text-right">
                      <AuditLogViewDetailsButton
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedLog(log);
                          setDetailOpen(true);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </AuditLogTable>
      </AuditLogTableShell>

      <AuditDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        record={selectedLog ? productLogToAuditDetail(selectedLog) : null}
      />
    </div>
  );
}
