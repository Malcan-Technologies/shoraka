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
  organizationLogTargetReference,
} from "@/components/organization-activity-timeline-details";
import {
  ORGANIZATION_ACTIVITY_EVENT_TYPES,
  useOrganizationLogs,
} from "@/hooks/use-organization-logs";
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { organizationLogToAuditDetail } from "@/components/audit/audit-adapters";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { OnboardingLogResponse } from "@cashsouk/types";
import {
  ClockIcon,
  ArrowPathIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

interface OrganizationActivityTimelineProps {
  organizationId: string | null;
  /** `panel` is the full-width activity tab; default `sidebar` keeps the compact rail layout. */
  variant?: "sidebar" | "panel";
  title?: string;
  description?: string;
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    ONBOARDING_STARTED: "Onboarding Started",
    ONBOARDING_FEE_PAID: "Onboarding Fee Paid",
    ONBOARDING_RESUMED: "Onboarding Resumed",
    ONBOARDING_STATUS_UPDATED: "Onboarding Status Updated",
    ONBOARDING_AMENDMENT_REQUIRED: "Additional Information Required",
    ONBOARDING_CANCELLED: "Onboarding Restarted",
    ONBOARDING_REJECTED: "Onboarding Rejected",
    COD_REJECTED: "Onboarding Rejected",
    ONBOARDING_APPROVED: "Onboarding Approved",
    AML_APPROVED: "AML Approved",
    TNC_APPROVED: "T&C Approved",
    TNC_ACCEPTED: "T&C Accepted",
    SSM_APPROVED: "SSM Approved",
    KYC_APPROVED: "KYC Approved",
    FINAL_APPROVAL_COMPLETED: "Final Approval Completed",
    SOPHISTICATED_STATUS_UPDATED: "Sophisticated Status Updated",
    FORM_FILLED: "Form Submitted",
    ONBOARDING_RESET: "Onboarding Reset",
    PROFILE_UPDATED: "Organization Profile Updated",
    MEMBER_ADDED: "Member Added",
    MEMBER_INVITED: "Member Invited",
    MEMBER_REMOVED: "Member Removed",
    MEMBER_ROLE_CHANGED: "Member Role Changed",
    MARC_ASSESSMENT_SAVED: "MARC Assessment Saved",
    USER_COMPLETED: "User Completed",
  };
  return (
    labels[eventType] ||
    eventType
      .split("_")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ")
  );
}

function formatTrigger(trigger: string): string {
  return trigger
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function buildEventDescription(
  eventType: string,
  metadata: Record<string, unknown> | null,
  log?: OnboardingLogResponse
): string | null {
  if (eventType === "PROFILE_UPDATED") {
    const fields = Array.isArray(metadata?.updatedFields)
      ? metadata.updatedFields.filter((field): field is string => typeof field === "string")
      : [];
    const actor = log ? organizationActorLabel(log) : "An admin";
    const organizationName = log?.organizationName?.trim();
    const fieldList = fields.length > 0 ? fields.join(", ") : null;
    if (organizationName && fieldList) {
      return `${actor} updated the organization profile for ${organizationName} (${fieldList}).`;
    }
    if (organizationName) {
      return `${actor} updated the organization profile for ${organizationName}.`;
    }
    return fieldList ? `Updated ${fieldList}` : "Profile updated by admin";
  }

  if (!metadata) return null;

  switch (eventType) {
    case "ONBOARDING_STATUS_UPDATED":
      if (metadata.trigger) return `Triggered by ${formatTrigger(String(metadata.trigger))}`;
      return null;
    case "ONBOARDING_REJECTED":
      return metadata.reason
        ? String(metadata.reason)
        : metadata.trigger
          ? `Triggered by ${formatTrigger(String(metadata.trigger))}`
          : null;
    case "ONBOARDING_CANCELLED":
      return metadata.reason ? String(metadata.reason) : null;
    case "ONBOARDING_RESET":
      return metadata.reason ? String(metadata.reason) : "Reset by admin";
    case "SOPHISTICATED_STATUS_UPDATED": {
      const action = metadata.action === "granted" ? "Granted" : "Revoked";
      const reason = metadata.newReason ? ` — ${metadata.newReason}` : "";
      return `${action}${reason}`;
    }
    case "FORM_FILLED":
      return metadata.section ? `Section: ${String(metadata.section)}` : null;
    case "AML_APPROVED":
    case "KYC_APPROVED":
      if (metadata.isCorporateOnboarding) return "Corporate onboarding";
      return null;
    case "MEMBER_ADDED":
      return metadata.memberEmail
        ? `Member added: ${String(metadata.memberEmail)}`
        : "A member was added to the organisation.";
    case "MEMBER_INVITED":
      return metadata.memberEmail
        ? `Invitation sent to ${String(metadata.memberEmail)}`
        : "A member invitation was created.";
    case "MEMBER_REMOVED":
      return metadata.memberEmail
        ? `Member removed: ${String(metadata.memberEmail)}`
        : "A member was removed from the organisation.";
    case "MEMBER_ROLE_CHANGED":
      if (metadata.previousRole && metadata.newRole) {
        return `Member role changed from ${String(metadata.previousRole)} to ${String(metadata.newRole)}.`;
      }
      return "A member role was changed.";
    case "MARC_ASSESSMENT_SAVED": {
      const next =
        metadata.nextValues && typeof metadata.nextValues === "object" && !Array.isArray(metadata.nextValues)
          ? (metadata.nextValues as Record<string, unknown>)
          : null;
      const grade = typeof next?.creditGrade === "string" ? next.creditGrade : null;
      return grade ? `MARC assessment saved (${grade}).` : "MARC assessment saved.";
    }
    default:
      return null;
  }
}

function organizationActorLabel(log: OnboardingLogResponse): string {
  const userName = [log.user?.first_name, log.user?.last_name].filter(Boolean).join(" ").trim();
  return userName || log.user?.email?.trim() || log.organizationName?.trim() || "System";
}

function organizationLogToActivityCsvRow(log: OnboardingLogResponse): AdminActivityCsvRow {
  return {
    createdAt: log.created_at,
    event: getEventLabel(log.event_type),
    eventType: log.event_type,
    actor: organizationActorLabel(log),
    actorUserId: log.user_id,
    portal: log.portal ?? "",
    remark: "",
    metadata: mergeActivityCsvMetadata(log.metadata, {
      organizationName: log.organizationName,
      ip_address: log.ip_address,
      device_type: log.device_type,
    }),
    actorType: log.actor_type,
    actorEmail: log.user.email,
    organisation: log.organizationName,
    source: log.source ?? log.portal,
    targetType: log.target_type,
    targetReference: organizationLogTargetReference(log),
    correlationId: log.correlation_id,
  };
}

function OrganizationActivityTimelineList({
  logs,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  onViewDetails,
}: {
  logs: OnboardingLogResponse[];
  hasNextPage: boolean | undefined;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  onViewDetails: (log: OnboardingLogResponse) => void;
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
        const eventType = log.event_type;
        const metadata = log.metadata;
        return (
          <AdminVerticalTimelineItem
            key={log.id}
            title={getEventLabel(eventType)}
            description={buildEventDescription(eventType, metadata, log)}
            descriptionClassName="line-clamp-2"
            createdAt={log.created_at}
            actorLabel={organizationActorLabel(log)}
            portal={log.portal}
            bylineChips={extractOrganizationTimelineBylineChips(metadata)}
            compactDetails={extractOrganizationTimelineCompactDetails(eventType, metadata)}
            onViewDetails={() => onViewDetails(log)}
          />
        );
      })}
    </AdminVerticalTimeline>
  );
}

export function OrganizationActivityTimeline({
  organizationId,
  variant = "sidebar",
  title = "Activity Timeline",
  description,
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

  const [selectedLog, setSelectedLog] = React.useState<OnboardingLogResponse | null>(null);
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
        title={title}
        description={
          description ??
          (totalCount === 0
            ? "No activity logs yet"
            : `${totalCount} ${totalCount === 1 ? "event" : "events"}`)
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
                  onViewDetails={setSelectedLog}
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
                    onViewDetails={setSelectedLog}
                  />
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
      <AuditDetailDrawer
        open={selectedLog != null}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null);
        }}
        record={
          selectedLog
            ? organizationLogToAuditDetail(
                selectedLog,
                getEventLabel(selectedLog.event_type),
                buildEventDescription(selectedLog.event_type, selectedLog.metadata, selectedLog)
              )
            : null
        }
      />
    </Card>
  );
}
