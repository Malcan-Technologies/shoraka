"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { AdminNotificationLog, AdminNotificationType } from "@cashsouk/types";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import { AuditLogDetailSheet } from "@/components/audit/audit-log-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationLogs } from "@/hooks/use-notification-logs";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "@/lib/handle-api-auth-error";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";

const PAGE_SIZE = 15;

const TARGET_OPTIONS = [
  { value: "ALL_USERS", label: "All Users" },
  { value: "INVESTORS", label: "Investors" },
  { value: "ISSUERS", label: "Issuers" },
  { value: "SPECIFIC_USERS", label: "Specific Users" },
  { value: "GROUP", label: "Group" },
] as const;

function portalTargetsLabel(targets: string[]): string {
  if (targets.includes("INVESTOR") && targets.includes("ISSUER")) return "Investor + Issuer";
  if (targets.includes("INVESTOR")) return "Investor";
  if (targets.includes("ISSUER")) return "Issuer";
  return "—";
}

export function NotificationLogsPanel() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [targetFilter, setTargetFilter] = React.useState("all");
  const [selectedLog, setSelectedLog] = React.useState<AdminNotificationLog | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const { data: types = [] } = useQuery({
    queryKey: ["admin-notification-types"],
    queryFn: async () => {
      const response = await apiClient.getAdminNotificationTypes();
      if (!response.success) {
        handleAdminApiQueryError(response.error);
      }
      return response.data;
    },
    retry: shouldRetryAdminApiQuery,
  });

  const apiParams = React.useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      search: searchQuery || undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
      target: targetFilter !== "all" ? targetFilter : undefined,
    }),
    [page, searchQuery, typeFilter, targetFilter]
  );

  const { data, isLoading, error } = useNotificationLogs(apiParams);

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter, targetFilter]);

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="notification audit" />;
  }

  const logs = data?.items ?? [];
  const totalCount = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.pages ?? 0;
  const hasFilters = Boolean(searchQuery) || typeFilter !== "all" || targetFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by admin name or email..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 rounded-xl bg-card pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-11 w-[200px] rounded-xl bg-card" aria-label="Notification type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((type: AdminNotificationType) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={targetFilter} onValueChange={setTargetFilter}>
          <SelectTrigger className="h-11 w-[180px] rounded-xl bg-card" aria-label="Audience">
            <SelectValue placeholder="All audiences" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All audiences</SelectItem>
            {TARGET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            className="h-11 gap-2 rounded-xl"
            onClick={() => {
              setSearchQuery("");
              setTypeFilter("all");
              setTargetFilter("all");
              setPage(1);
            }}
          >
            <XMarkIcon className="h-4 w-4" />
            Clear
          </Button>
        ) : null}

        <Button
          variant="outline"
          className="h-11 gap-2 rounded-xl bg-card"
          disabled={isLoading}
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "notification-logs"] })}
        >
          <ArrowPathIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        <Badge variant="secondary" className="h-11 rounded-xl px-4 text-sm font-normal">
          {totalCount} {totalCount === 1 ? "record" : "records"}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 7 }).map((__, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No notification audit records found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(log.occurredAt), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      Processed
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {log.actor.displayName || "—"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {log.actor.email || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{log.audienceType.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm">
                    <div>{log.notificationTypeName || "Custom"}</div>
                    {log.portalTargets.length ? (
                      <span className="text-xs text-muted-foreground">
                        {portalTargetsLabel(log.portalTargets)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <p className="truncate text-sm font-medium">{log.title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{log.message}</p>
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
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({totalCount} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeftIcon className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRightIcon className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <AuditLogDetailSheet
        log={
          selectedLog
            ? {
                id: selectedLog.id,
                eventType: selectedLog.eventType,
                eventLabel: "Notification broadcast processed",
                occurredAt: selectedLog.occurredAt,
                createdAt: selectedLog.createdAt,
                actorType: selectedLog.actor.type,
                actorName: selectedLog.actor.displayName,
                actorEmail: selectedLog.actor.email,
                actorUserId: selectedLog.actor.userId,
                targetType: selectedLog.target.type,
                targetId: selectedLog.target.id,
                source: selectedLog.source,
                portal: selectedLog.portal,
                ipAddress: selectedLog.ipAddress,
                userAgent: selectedLog.userAgent,
                deviceInfo: selectedLog.deviceInfo,
                correlationId: selectedLog.correlationId,
                extraFields: [
                  { label: "Audience", value: selectedLog.audienceType },
                  { label: "Notification type", value: selectedLog.notificationTypeName },
                  { label: "Notification type ID", value: selectedLog.notificationTypeId },
                  { label: "Title", value: selectedLog.title },
                  { label: "Targeted", value: String(selectedLog.targetedCount) },
                  { label: "Created", value: String(selectedLog.createdCount) },
                  { label: "Skipped", value: String(selectedLog.skippedCount) },
                  { label: "Failed", value: String(selectedLog.failedCount) },
                  { label: "Channel mode", value: selectedLog.channelMode },
                  { label: "Group ID", value: selectedLog.groupId },
                ],
                metadata: selectedLog.metadata,
              }
            : null
        }
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Notification audit"
        description="Broadcast operation recorded in NotificationBroadcastAuditLog."
      />
    </div>
  );
}
