"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@cashsouk/ui";
import { useApplicationActivities } from "@/hooks/use-application-activities";
import { formatDistanceToNow, format } from "date-fns";
import {
  ClockIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  PlayIcon,
  ChevronDownIcon,
  UserIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";

interface AdminActivityTimelineProps {
  organizationId: string | null;
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "ISSUER_CREATED":
      return <PlayIcon className="h-3.5 w-3.5 text-blue-600" />;
    case "ISSUER_SUBMITTED":
      return <ArrowPathIcon className="h-3.5 w-3.5 text-blue-500" />;
    case "APPROVED":
      return <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "REJECTED":
      return <XCircleIcon className="h-3.5 w-3.5 text-destructive" />;
    case "SOPHISTICATED_STATUS_UPDATED":
      return <StarIcon className="h-3.5 w-3.5 text-violet-600" />;
    case "FORM_FILLED":
      return <DocumentTextIcon className="h-3.5 w-3.5 text-blue-500" />;
    default:
      return <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    ISSUER_CREATED: "Issuer Created",
    ISSUER_SUBMITTED: "Issuer Submitted",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    FORM_FILLED: "Form Submitted",
    SOPHISTICATED_STATUS_UPDATED: "Sophisticated Status Updated",
  };
  return (
    labels[eventType] ||
    eventType
      .split("_")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ")
  );
}

function getEventDotColor(eventType: string): string {
  switch (eventType) {
    case "ISSUER_CREATED":
    case "ISSUER_SUBMITTED":
    case "FORM_FILLED":
      return "bg-blue-500";
    case "APPROVED":
      return "bg-emerald-500";
    case "REJECTED":
      return "bg-destructive";
    case "SOPHISTICATED_STATUS_UPDATED":
      return "bg-violet-500";
    default:
      return "bg-muted-foreground";
  }
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-3 w-3 rounded-full shrink-0 mt-1.5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminActivityTimeline({ organizationId }: AdminActivityTimelineProps) {
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useApplicationActivities(organizationId);

  const logs = React.useMemo(
    () => data?.pages.flatMap((page) => page.activities) ?? [],
    [data]
  );

  const totalCount = data?.pages[0]?.pagination.total ?? 0;

  return (
    <Card className="rounded-2xl flex flex-col overflow-hidden">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base font-semibold">Activity Timeline</CardTitle>
          </div>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {totalCount}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Organization events and status changes
        </p>
      </CardHeader>

      <CardContent className="overflow-hidden min-h-0">
        {isLoading && (
          <div className="px-6 pb-12">
            <TimelineSkeleton />
          </div>
        )}

        {error && (
          <div className="px-6 pb-12 text-sm text-destructive">
            Failed to load activity logs
          </div>
        )}

        {!isLoading && !error && logs.length === 0 && (
          <div className="px-6 pb-12 text-sm text-muted-foreground text-center py-8">
            No activity logs found
          </div>
        )}

        {!isLoading && logs.length > 0 && (
          <>
            <ScrollArea className="overflow-auto">
              <div className="">
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-5">
                    {logs.map((log, index) => {
                      const eventType = log.event_type;
                      const isFirst = index === 0;
                      const actorName = (log.metadata && (log.metadata.actorName || log.metadata.organizationName)) || "System";
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const metadata = log.metadata as Record<string, unknown> | null;

                      return (
                        <div key={log.id} className="relative flex gap-3 pl-0">
                          {/* Dot indicator */}
                          <div
                            className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-card ${getEventDotColor(eventType)} ${isFirst ? "ring-2 ring-primary/20" : ""}`}
                          />

                          <div className="flex-1 min-w-0 -mt-0.5">
                            {/* Event label and icon */}
                            <div className="flex items-center gap-1.5">
                              {getEventIcon(eventType)}
                              <span className="text-sm font-medium leading-tight">
                                {getEventLabel(eventType)}
                              </span>
                            </div>

                            {/* Activity text */}
                            {log.activity && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {log.activity}
                              </p>
                            )}

                            {/* Actor + context row */}
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/70">
                              <span className="inline-flex items-center gap-0.5">
                                <UserIcon className="h-3 w-3" />
                                {actorName}
                              </span>
                              {((metadata && (metadata.portal || metadata.portalType)) || undefined) && (
                                <span className="inline-flex items-center gap-0.5">
                                  <GlobeAltIcon className="h-3 w-3" />
                                  {String((metadata && (metadata.portal || metadata.portalType)) || "")}
                                </span>
                              )}
                              {((metadata && (metadata.device_type || metadata.device_info)) || undefined) && (
                                <span className="inline-flex items-center gap-0.5">
                                  <ComputerDesktopIcon className="h-3 w-3" />
                                  {String((metadata && (metadata.device_type || metadata.device_info)) || "")}
                                </span>
                              )}
                            </div>

                            {/* IP address */}
                            {log.ip_address && (
                              <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">
                                {log.ip_address}
                              </p>
                            )}

                            {/* Timestamp */}
                            <p
                              className="text-[11px] text-muted-foreground/70 mt-1"
                              title={format(new Date(log.created_at), "PPpp")}
                            >
                              {formatDistanceToNow(new Date(log.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {hasNextPage && (
              <div className="px-6 py-3 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isFetchingNextPage ? (
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  )}
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminActivityTimeline;

