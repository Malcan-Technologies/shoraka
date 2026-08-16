"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@cashsouk/ui";
import { useOrganizationLogs } from "@/hooks/use-organization-logs";
import { formatDistanceToNow, format } from "date-fns";
import { formatOnboardingActivity } from "@cashsouk/types";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  StarIcon,
  PlayIcon,
  ChevronDownIcon,
  UserIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";

interface OrganizationActivityTimelineProps {
  organizationId: string | null;
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "ONBOARDING_STARTED":
      return <PlayIcon className="h-3.5 w-3.5 text-blue-600" />;
    case "ONBOARDING_RESUMED":
      return <ArrowPathIcon className="h-3.5 w-3.5 text-blue-500" />;
    case "ONBOARDING_STATUS_CHANGED":
      return <ClockIcon className="h-3.5 w-3.5 text-amber-500" />;
    case "ONBOARDING_RESTARTED":
    case "ONBOARDING_RESET":
      return <ArrowPathIcon className="h-3.5 w-3.5 text-amber-600" />;
    case "ONBOARDING_REJECTED":
      return <XCircleIcon className="h-3.5 w-3.5 text-destructive" />;
    case "ONBOARDING_APPROVED":
    case "ONBOARDING_FINAL_APPROVAL_COMPLETED":
    case "ONBOARDING_COMPLETED":
      return <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "AML_APPROVED":
      return <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "SSM_APPROVED":
    case "CTOS_REPORT_RECEIVED":
      return <DocumentTextIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "INVESTOR_SOPHISTICATED_STATUS_UPDATED":
      return <StarIcon className="h-3.5 w-3.5 text-violet-600" />;
    case "USER_ONBOARDING_STATUS_UPDATED":
    case "CORPORATE_ENTITIES_UPDATED":
    case "DIRECTOR_ONBOARDING_INVITATION_SENT":
    case "DIRECTOR_KYC_STATUS_UPDATED":
      return <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getEventLabel(eventType: string, metadata?: Record<string, unknown> | null): string {
  return formatOnboardingActivity("admin", eventType, metadata ?? undefined).title;
}

function getEventDotColor(eventType: string): string {
  switch (eventType) {
    case "ONBOARDING_STARTED":
    case "ONBOARDING_RESUMED":
    case "ONBOARDING_RESTARTED":
      return "bg-blue-500";
    case "ONBOARDING_APPROVED":
    case "AML_APPROVED":
    case "SSM_APPROVED":
    case "ONBOARDING_FINAL_APPROVAL_COMPLETED":
    case "ONBOARDING_COMPLETED":
    case "CTOS_REPORT_RECEIVED":
      return "bg-emerald-500";
    case "ONBOARDING_RESET":
      return "bg-muted-foreground";
    case "ONBOARDING_REJECTED":
      return "bg-destructive";
    case "INVESTOR_SOPHISTICATED_STATUS_UPDATED":
      return "bg-violet-500";
    case "ONBOARDING_STATUS_CHANGED":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground";
  }
}

function buildEventDescription(
  eventType: string,
  metadata: Record<string, unknown> | null
): string {
  return formatOnboardingActivity("admin", eventType, metadata ?? undefined).description;
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

export function OrganizationActivityTimeline({
  organizationId,
}: OrganizationActivityTimelineProps) {
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useOrganizationLogs(organizationId);

  const logs = React.useMemo(
    () => data?.pages.flatMap((page) => page.logs) ?? [],
    [data]
  );

  const totalCount = data?.pages[0]?.pagination.totalCount ?? 0;

  return (
    <Card className="rounded-2xl flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Activity Timeline</CardTitle>
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

      <CardContent className="flex-1 overflow-hidden pt-0 px-0">
        {isLoading && (
          <div className="px-6 pb-4">
            <TimelineSkeleton />
          </div>
        )}

        {error && (
          <div className="px-6 pb-4 text-sm text-destructive">
            Failed to load activity logs
          </div>
        )}

        {!isLoading && !error && logs.length === 0 && (
          <div className="px-6 pb-4 text-sm text-muted-foreground text-center py-8">
            No activity logs found
          </div>
        )}

        {!isLoading && logs.length > 0 && (
          <ScrollArea className="h-full">
            <div className="px-6 pb-4">
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

                <div className="space-y-5">
                  {logs.map((log, index) => {
                    const eventType = log.eventType;
                    const isFirst = index === 0;
                    const actorType = String(log.actor?.type ?? "").trim().toUpperCase();
                    const isIntegrationActor = actorType === "INTEGRATION" || actorType === "SYSTEM";
                    const resolvedName = String(log.actor.displayName ?? "").trim();
                    const actorName = !isIntegrationActor && resolvedName ? resolvedName : "System";
                    const showDeviceAndIp = !isIntegrationActor;
                    const metadata = log.metadata as Record<string, unknown> | null;
                    const description = buildEventDescription(eventType, metadata);

                    return (
                      <div key={log.id} className="relative flex gap-3 pl-0">
                        {/* Dot indicator */}
                        <div
                          className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-card ${getEventDotColor(eventType)} ${isFirst ? "ring-2 ring-primary/20" : ""}`}
                        />

                        <div className="flex-1 min-w-0 -mt-0.5">
                          {/* Event label and icon */}
                          <div className="flex items-start gap-1.5 min-w-0">
                            {getEventIcon(eventType)}
                            <span className="text-sm font-medium leading-tight break-words min-w-0">
                              {getEventLabel(eventType, metadata)}
                            </span>
                          </div>

                          {description ? (
                            <p className="text-xs text-muted-foreground mt-0.5 break-words">
                              {description}
                            </p>
                          ) : null}

                          {/* Actor + context row */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-muted-foreground/70">
                            <span className="inline-flex items-center gap-0.5 whitespace-nowrap max-w-full">
                              <UserIcon className="h-3 w-3 shrink-0" />
                              {actorName}
                            </span>
                            {actorType === "ADMIN" ? (
                              <span className="whitespace-nowrap">ADMIN</span>
                            ) : log.portal ? (
                              <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                                <GlobeAltIcon className="h-3 w-3 shrink-0" />
                                {log.portal}
                              </span>
                            ) : null}
                            {showDeviceAndIp && log.deviceInfo ? (
                              <span className="inline-flex items-center gap-0.5 min-w-0">
                                <ComputerDesktopIcon className="h-3 w-3 shrink-0" />
                                <span className="break-all">{log.deviceInfo}</span>
                              </span>
                            ) : null}
                            {showDeviceAndIp && log.ipAddress ? (
                              <span className="font-mono break-all">{log.ipAddress}</span>
                            ) : null}
                          </div>

                          {/* Timestamp */}
                          <p
                            className="text-[11px] text-muted-foreground/70 mt-1"
                            title={format(new Date(log.occurredAt), "PPpp")}
                          >
                            {formatDistanceToNow(new Date(log.occurredAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Load More */}
              {hasNextPage && (
                <div className="mt-4 flex justify-center">
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
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
