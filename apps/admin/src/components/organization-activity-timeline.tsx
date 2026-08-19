"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { AdminActivityCsvExportButton } from "@/components/admin-activity-csv-export-button";
import {
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "@/components/admin-activity-csv";
import {
  AdminVerticalTimeline,
  AdminVerticalTimelineItem,
  AdminVerticalTimelineSkeleton,
} from "@/components/admin-vertical-timeline";
import {
  extractOrganizationTimelineBylineChips,
  extractOrganizationTimelineCompactDetails,
} from "@/components/organization-activity-timeline-details";
import {
  ORGANIZATION_ACTIVITY_EVENT_TYPES,
  useOrganizationLogs,
} from "@/hooks/use-organization-logs";
import { formatOnboardingActivity, type OnboardingLogResponse } from "@cashsouk/types";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  ClockIcon,
  ArrowPathIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

interface OrganizationActivityTimelineProps {
  organizationId: string | null;
  /** `panel` is the full-width activity tab; default `sidebar` keeps the compact rail layout. */
  variant?: "sidebar" | "panel";
}

function getEventLabel(eventType: string, metadata?: Record<string, unknown> | null): string {
  return formatOnboardingActivity("admin", eventType, metadata ?? undefined).title;
}

function buildEventDescription(
  eventType: string,
  metadata: Record<string, unknown> | null
): string | null {
  const description = formatOnboardingActivity("admin", eventType, metadata ?? undefined).description;
  return description.trim() ? description : null;
}

function organizationActorLabel(log: OnboardingLogResponse): string {
  const actorType = String(log.actor?.type ?? "").trim().toUpperCase();
  if (actorType === "INTEGRATION" || actorType === "SYSTEM") return "System";
  return String(log.actor.displayName ?? "").trim() || "System";
}

function organizationLogToActivityCsvRow(log: OnboardingLogResponse): AdminActivityCsvRow {
  return {
    createdAt: log.occurredAt,
    event: getEventLabel(log.eventType, log.metadata),
    eventType: log.eventType,
    actor: organizationActorLabel(log),
    actorUserId: log.actor.userId ?? log.userId ?? "",
    portal: log.portal ?? "",
    remark: "",
    metadata: mergeActivityCsvMetadata(log.metadata, {
      actorType: log.actor.type,
      ipAddress: log.ipAddress,
      deviceInfo: log.deviceInfo,
    }),
  };
}

function OrganizationActivityTimelineList({
  logs,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
}: {
  logs: OnboardingLogResponse[];
  hasNextPage: boolean | undefined;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}) {
  return (
    <AdminVerticalTimeline
      footer={
        hasNextPage ? (
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="gap-1.5 text-ui text-muted-foreground hover:text-foreground"
            >
              {isFetchingNextPage ? (
                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5" />
              )}
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          </div>
        ) : null
      }
    >
      {logs.map((log) => {
        const eventType = log.eventType;
        const metadata = log.metadata;
        return (
          <AdminVerticalTimelineItem
            key={log.id}
            title={getEventLabel(eventType, metadata)}
            description={buildEventDescription(eventType, metadata)}
            descriptionClassName="line-clamp-2"
            createdAt={log.occurredAt}
            actorLabel={organizationActorLabel(log)}
            portal={log.portal}
            bylineChips={extractOrganizationTimelineBylineChips(metadata)}
            compactDetails={extractOrganizationTimelineCompactDetails(eventType, metadata)}
          />
        );
      })}
    </AdminVerticalTimeline>
  );
}

export function OrganizationActivityTimeline({
  organizationId,
  variant = "sidebar",
}: OrganizationActivityTimelineProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
    getAccessToken
  );
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
  const isPanel = variant === "panel";

  const loadCsvRows = React.useCallback(async (): Promise<AdminActivityCsvRow[]> => {
    if (!organizationId) return logs.map(organizationLogToActivityCsvRow);
    if (logs.length >= totalCount) return logs.map(organizationLogToActivityCsvRow);

    const all: OnboardingLogResponse[] = [];
    let page = 1;
    while (true) {
      const response = await apiClient.getOnboardingLogs({
        page,
        pageSize: 100,
        organizationId,
        eventTypes: ORGANIZATION_ACTIVITY_EVENT_TYPES,
      });
      if (!response.success) throw new Error(response.error.message);
      all.push(...response.data.logs);
      if (all.length >= response.data.pagination.totalCount) break;
      page += 1;
    }
    return all.map(organizationLogToActivityCsvRow);
  }, [apiClient, logs, organizationId, totalCount]);

  return (
    <Card className={isPanel ? "rounded-2xl" : "flex h-full flex-col overflow-hidden rounded-2xl"}>
      <AdminDetailCardHeader
        icon={ClockIcon}
        title="Activity Timeline"
        description={
          totalCount === 0
            ? "No activity logs yet"
            : `${totalCount} ${totalCount === 1 ? "event" : "events"}`
        }
        actions={
          <AdminActivityCsvExportButton
            fileName={`organization-${organizationId ?? "activity"}-activity.csv`}
            rows={loadCsvRows}
            disabled={totalCount === 0}
          />
        }
      />

      <CardContent className={isPanel ? "px-0 pt-0" : "flex-1 overflow-hidden px-0 pt-0"}>
        {isLoading && (
          <div className="px-6 pb-4">
            <AdminVerticalTimelineSkeleton />
          </div>
        )}

        {error && (
          <div className="px-6 pb-4 text-ui text-destructive">Failed to load activity logs</div>
        )}

        {!isLoading && !error && logs.length === 0 && (
          <div className="px-6 py-8 pb-4 text-center text-ui text-muted-foreground">
            No activity logs found
          </div>
        )}

        {!isLoading && !error && logs.length > 0 && (
          <div className={isPanel ? undefined : "h-full overflow-hidden"}>
            {isPanel ? (
              <div className="px-6 pb-4">
                <OrganizationActivityTimelineList
                  logs={logs}
                  hasNextPage={hasNextPage}
                  fetchNextPage={fetchNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                />
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="px-6 pb-4">
                  <OrganizationActivityTimelineList
                    logs={logs}
                    hasNextPage={hasNextPage}
                    fetchNextPage={fetchNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                  />
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
