"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@cashsouk/ui";
import { useOrganizationLogs } from "@/hooks/use-organization-logs";
import { formatDistanceToNow, format } from "date-fns";
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
import type { OnboardingEventType } from "@cashsouk/types";

interface OrganizationActivityTimelineProps {
  organizationId: string | null;
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "ONBOARDING_STARTED":
      return <PlayIcon className="h-3.5 w-3.5 text-blue-600" />;
    case "ONBOARDING_RESUMED":
      return <ArrowPathIcon className="h-3.5 w-3.5 text-blue-500" />;
    case "ONBOARDING_STATUS_UPDATED":
      return <ClockIcon className="h-3.5 w-3.5 text-amber-500" />;
    case "ONBOARDING_CANCELLED":
      return <XCircleIcon className="h-3.5 w-3.5 text-muted-foreground" />;
    case "ONBOARDING_REJECTED":
      return <XCircleIcon className="h-3.5 w-3.5 text-destructive" />;
    case "ONBOARDING_APPROVED":
      return <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "AML_APPROVED":
      return <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "TNC_APPROVED":
    case "TNC_ACCEPTED":
      return <DocumentTextIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "SSM_APPROVED":
      return <DocumentTextIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "KYC_APPROVED":
    case "KYB_APPROVED":
      return <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "FINAL_APPROVAL_COMPLETED":
      return <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-700" />;
    case "SOPHISTICATED_STATUS_UPDATED":
      return <StarIcon className="h-3.5 w-3.5 text-violet-600" />;
    case "FORM_FILLED":
      return <DocumentTextIcon className="h-3.5 w-3.5 text-blue-500" />;
    case "ONBOARDING_RESET":
      return <ArrowPathIcon className="h-3.5 w-3.5 text-amber-600" />;
    default:
      return <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    ONBOARDING_STARTED: "Onboarding Started",
    ONBOARDING_RESUMED: "Onboarding Resumed",
    ONBOARDING_STATUS_UPDATED: "Status Updated",
    ONBOARDING_CANCELLED: "Onboarding Cancelled",
    ONBOARDING_REJECTED: "Onboarding Rejected",
    ONBOARDING_APPROVED: "Onboarding Approved",
    AML_APPROVED: "AML Approved",
    TNC_APPROVED: "T&C Approved",
    TNC_ACCEPTED: "T&C Accepted",
    SSM_APPROVED: "SSM Approved",
    KYC_APPROVED: "KYC Approved",
    KYB_APPROVED: "KYB Approved",
    FINAL_APPROVAL_COMPLETED: "Final Approval Completed",
    SOPHISTICATED_STATUS_UPDATED: "Sophisticated Status Updated",
    FORM_FILLED: "Form Submitted",
    ONBOARDING_RESET: "Onboarding Reset",
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

function getEventDotColor(eventType: string): string {
  switch (eventType) {
    case "ONBOARDING_STARTED":
    case "ONBOARDING_RESUMED":
    case "FORM_FILLED":
      return "bg-blue-500";
    case "ONBOARDING_APPROVED":
    case "AML_APPROVED":
    case "TNC_APPROVED":
    case "TNC_ACCEPTED":
    case "SSM_APPROVED":
    case "KYC_APPROVED":
    case "KYB_APPROVED":
    case "FINAL_APPROVAL_COMPLETED":
    case "USER_COMPLETED":
      return "bg-emerald-500";
    case "ONBOARDING_CANCELLED":
    case "ONBOARDING_RESET":
      return "bg-muted-foreground";
    case "ONBOARDING_REJECTED":
      return "bg-destructive";
    case "SOPHISTICATED_STATUS_UPDATED":
      return "bg-violet-500";
    case "ONBOARDING_STATUS_UPDATED":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground";
  }
}

/**
 * Builds a human-readable description from event metadata.
 */
function buildEventDescription(
  eventType: string,
  metadata: Record<string, unknown> | null
): string | null {
  if (!metadata) return null;

  switch (eventType) {
    case "ONBOARDING_STATUS_UPDATED":
      if (metadata.trigger)
        return `Triggered by ${formatTrigger(String(metadata.trigger))}`;
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
      return metadata.section
        ? `Section: ${String(metadata.section)}`
        : null;
    case "AML_APPROVED":
    case "KYB_APPROVED":
    case "KYC_APPROVED":
      if (metadata.isCorporateOnboarding)
        return "Corporate onboarding";
      return null;
    default:
      return null;
  }
}

function formatTrigger(trigger: string): string {
  return trigger
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Extracts structured metadata details to render as key-value pairs.
 */
function extractMetadataDetails(
  eventType: string,
  metadata: Record<string, unknown> | null
): { label: string; value: string }[] {
  if (!metadata) return [];

  const details: { label: string; value: string }[] = [];

  // Status transition
  if (metadata.previousStatus && metadata.newStatus) {
    details.push({
      label: "Transition",
      value: `${String(metadata.previousStatus)} → ${String(metadata.newStatus)}`,
    });
  } else if (metadata.newStatus) {
    details.push({ label: "Status", value: String(metadata.newStatus) });
  }

  // Risk info
  if (metadata.riskLevel) {
    details.push({ label: "Risk", value: String(metadata.riskLevel) });
  }
  if (metadata.riskScore) {
    details.push({ label: "Score", value: String(metadata.riskScore) });
  }

  // Actor — prefer resolved name, fall back to shortened ID
  if (metadata.approvedBy) {
    details.push({ label: "Approved by", value: String(metadata.approvedByName || shortenId(String(metadata.approvedBy))) });
  }
  if (metadata.cancelledBy) {
    details.push({ label: "Cancelled by", value: String(metadata.cancelledByName || shortenId(String(metadata.cancelledBy))) });
  }
  if (metadata.updatedBy) {
    details.push({ label: "Updated by", value: String(metadata.updatedByName || shortenId(String(metadata.updatedBy))) });
  }
  if (metadata.resetBy) {
    details.push({ label: "Reset by", value: String(metadata.resetByName || shortenId(String(metadata.resetBy))) });
  }

  // Portal/org type
  if (metadata.portalType && eventType !== "ONBOARDING_STATUS_UPDATED") {
    details.push({ label: "Portal", value: String(metadata.portalType) });
  }
  if (metadata.organizationType) {
    details.push({ label: "Type", value: String(metadata.organizationType) });
  }

  return details;
}

function shortenId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
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
                    const eventType = log.event_type;
                    const isFirst = index === 0;
                    const actorName = log.organization_name || "System";
                    const metadata = log.metadata as Record<string, unknown> | null;
                    const description = buildEventDescription(eventType, metadata);
                    const details = extractMetadataDetails(eventType, metadata);

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

                          {/* Description */}
                          {description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {description}
                            </p>
                          )}

                          {/* Status transition & structured metadata */}
                          {details.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {details.map((d, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-[10px] h-5 px-1.5 font-normal"
                                >
                                  <span className="text-muted-foreground mr-0.5">
                                    {d.label}:
                                  </span>
                                  {d.value}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Actor + context row */}
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/70">
                            <span className="inline-flex items-center gap-0.5">
                              <UserIcon className="h-3 w-3" />
                              {actorName}
                            </span>
                            {log.portal && (
                              <span className="inline-flex items-center gap-0.5">
                                <GlobeAltIcon className="h-3 w-3" />
                                {log.portal}
                              </span>
                            )}
                            {log.device_type && (
                              <span className="inline-flex items-center gap-0.5">
                                <ComputerDesktopIcon className="h-3 w-3" />
                                {log.device_type}
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
