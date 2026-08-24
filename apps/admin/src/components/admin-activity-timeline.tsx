"use client";

/**
 * Guide: docs/guides/admin/activity-timeline.md — Event labels for activity timeline display
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { AdminActivityCsvExportButton } from "@/components/admin-activity-csv-export-button";
import {
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "@/components/admin-activity-csv";
import {
  AdminTimelineDetailCard,
  AdminVerticalTimeline,
  AdminVerticalTimelineItem,
  AdminVerticalTimelineSkeleton,
} from "@/components/admin-vertical-timeline";
import { resolveAdminTimelineActorLabel } from "@/components/admin-timeline-originator";
import { ChevronDownIcon, ClockIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { formatRemarkAsBullets } from "@/lib/utils";
import { getReviewTabLabel } from "@/components/application-review/review-registry";
import { formatCurrency } from "@cashsouk/config";
import { getItemDisplayNameFromScopeKey, formatPhaseDeadlineAbsolute } from "@cashsouk/types";
import type {
  ResubmitChangesMetadata,
  ResubmitFieldChangeItem,
} from "@/components/application-revision-diff-panel";
import { ResubmitComparisonModal } from "@/components/resubmit-comparison-modal";
import { reviewSectionHasResubmitChanges } from "@/lib/review-section-has-resubmit-changes";
import type { ReviewSectionId } from "@/components/application-review/review-registry";
import {
  useApplicationLogs,
  type ApplicationLogEntry,
} from "@/hooks/use-application-logs";

type ActivityMetadata = {
  scope_key?: string;
  entityId?: string;
  remark?: string;
  actorName?: string;
  organizationName?: string;
  portal?: string;
  portalType?: string;
  device_type?: string;
  device_info?: string;
  invoice_number?: string | null;
  requested_facility?: number;
  offered_facility?: number;
  requested_amount?: number;
  offered_amount?: number;
  offered_ratio_percent?: number | null;
  offered_profit_rate_percent?: number | null;
  expires_at?: string | null;
  acceptance_expires_at?: string | null;
  rejection_reason?: string;
  resubmit_changes?: ResubmitChangesMetadata;
};

function formatItemLabelFromScopeKey(scopeKey: string): string {
  return getItemDisplayNameFromScopeKey(scopeKey);
}

interface AdminActivityTimelineProps {
  applicationId: string | null;
  /** Product id (same as route `productKey`) for workflow tabs in resubmit comparison modal. */
  productKey?: string | null;
  /** Section review statuses from application detail — same dots as main review tabs in comparison modal. */
  reviewTabSections?: { section: string; status: string }[];
  /** Override section labels for display (e.g. contract_details → "Customer" for invoice_only). */
  sectionLabelOverrides?: Record<string, string>;
  /** Pass through to resubmit comparison modal so tabs match main application detail. */
  visibleReviewSections?: unknown;
}

function formatResubmitTabsOnlyActivity({
  resubmitChanges,
  sectionLabelOverrides,
}: {
  resubmitChanges: ResubmitChangesMetadata | undefined;
  sectionLabelOverrides?: Record<string, string>;
}): string | null {
  const fieldChanges = resubmitChanges?.field_changes;
  if (!Array.isArray(fieldChanges) || fieldChanges.length === 0) return null;

  const orderedSections: ReviewSectionId[] = [
    "financial",
    "company_details",
    "business_details",
    "supporting_documents",
    "acceptance_documents",
    "contract_details",
    "invoice_details",
  ];

  const changedSections = orderedSections.filter((section) =>
    reviewSectionHasResubmitChanges(section, fieldChanges as { path: string }[])
  );

  if (changedSections.length === 0) return null;

  const labels = changedSections.map(
    (section) => sectionLabelOverrides?.[String(section)] ?? getReviewTabLabel(String(section))
  );

  return `Changes submitted: ${labels.join(", ")}`;
}

const ACTION_LABELS: Record<string, string> = {
  SECTION_REVIEWED_APPROVED: "Section Approved",
  SECTION_REVIEWED_REJECTED: "Section Rejected",
  SECTION_REVIEWED_AMENDMENT_REQUESTED: "Section Amendment Requested",
  SECTION_REVIEWED_PENDING: "Section Reset to Pending",
  ITEM_REVIEWED_APPROVED: "Approved",
  ITEM_REVIEWED_REJECTED: "Rejected",
  ITEM_REVIEWED_AMENDMENT_REQUESTED: "Amendment Requested",
  ITEM_REVIEWED_PENDING: "Reset to Pending",
};

function getEventLabel(
  eventType: string,
  metadata?: Record<string, unknown> | null,
  entityId?: string | null,
  sectionLabelOverrides?: Record<string, string>
): string {
  const baseLabels: Record<string, string> = {
    APPLICATION_CREATED: "Application Created",
    APPLICATION_SUBMITTED: "Application Submitted",
    APPLICATION_RESUBMITTED: "Application Resubmitted",
    APPLICATION_APPROVED: "Application Approved",
    APPLICATION_REJECTED: "Application Rejected",
    APPLICATION_WITHDRAWN: "Application Withdrawn",
    APPLICATION_COMPLETED: "Application Completed",
    APPLICATION_RESET_TO_UNDER_REVIEW: "Application Reset to Under Review",
    CONTRACT_OFFER_SENT: "Facility Offer Sent",
    CONTRACT_OFFER_ACCEPTANCE_SUBMITTED: "Facility Offer Acceptance Submitted",
    CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED: "Facility Offer Acceptance Resubmitted",
    CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING: "Facility Acceptance Approved for Signing",
    CONTRACT_OFFER_ACCEPTED: "Facility Offer Signed",
    CONTRACT_OFFER_REJECTED: "Facility Offer Withdrawn",
    CONTRACT_OFFER_RETRACTED: "Facility Offer Retracted",
    CONTRACT_FACILITY_OCCUPANCY_UPDATED: "Facility Occupancy Updated",
    CONTRACT_OFFER_EXPIRED: "Facility Offer Expired",
    CONTRACT_SIGNING_DEADLINE_EXTENDED: "Signing Deadline Extended",
    CONTRACT_WITHDRAWN: "Facility Offer Rejected",
    INVOICE_OFFER_SENT: "Invoice Offer Sent",
    INVOICE_OFFER_ACCEPTANCE_SUBMITTED: "Invoice Offer Acceptance Submitted",
    INVOICE_OFFER_ACCEPTANCE_RESUBMITTED: "Invoice Offer Acceptance Resubmitted",
    INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING: "Invoice Acceptance Approved for Signing",
    INVOICE_OFFER_ACCEPTED: "Invoice Offer Signed",
    INVOICE_OFFER_REJECTED: "Invoice Offer Rejected",
    INVOICE_OFFER_RETRACTED: "Invoice Offer Retracted",
    INVOICE_OFFER_EXPIRED: "Invoice Offer Expired",
    INVOICE_SIGNING_DEADLINE_EXTENDED: "Signing Deadline Extended",
    INVOICE_WITHDRAWN: "Invoice Withdrawn",
    SIGNING_PACKAGE_CREATED: "Signing Package Created",
    SIGNING_PACKAGE_SENT: "Signing Package Sent",
    SIGNING_PACKAGE_VOIDED: "Signing Package Voided",
    AMENDMENTS_SUBMITTED: "Amendment Request Sent",
  };
  if (eventType === "INVOICE_OFFER_SENT") {
    const invoiceNumber = metadata?.invoice_number;
    return invoiceNumber != null && invoiceNumber !== ""
      ? `Invoice ${invoiceNumber} Offer Sent`
      : "Invoice Offer Sent";
  }
  if (eventType === "INVOICE_OFFER_ACCEPTANCE_SUBMITTED") {
    const invoiceNumber = metadata?.invoice_number;
    return invoiceNumber != null && invoiceNumber !== ""
      ? `Invoice ${invoiceNumber} Acceptance Submitted`
      : "Invoice Offer Acceptance Submitted";
  }
  if (eventType === "INVOICE_OFFER_ACCEPTED") {
    const invoiceNumber = metadata?.invoice_number;
    return invoiceNumber != null && invoiceNumber !== ""
      ? `Invoice ${invoiceNumber} Offer Signed`
      : "Invoice Offer Signed";
  }
  if (eventType === "INVOICE_OFFER_REJECTED") {
    const invoiceNumber = metadata?.invoice_number;
    return invoiceNumber != null && invoiceNumber !== ""
      ? `Invoice ${invoiceNumber} Offer Rejected`
      : "Invoice Offer Rejected";
  }
  if (eventType === "INVOICE_WITHDRAWN") {
    const invoiceNumber = metadata?.invoice_number;
    return invoiceNumber != null && invoiceNumber !== ""
      ? `Invoice ${invoiceNumber} Withdrawn`
      : "Invoice Withdrawn";
  }
  if (eventType === "INVOICE_OFFER_EXPIRED") {
    const invoiceNumber = metadata?.invoice_number;
    return invoiceNumber != null && invoiceNumber !== ""
      ? `Invoice ${invoiceNumber} Offer Expired`
      : "Invoice Offer Expired";
  }
  if (baseLabels[eventType]) return baseLabels[eventType];

  const actionLabel = ACTION_LABELS[eventType];
  if (actionLabel) {
    if (eventType.startsWith("SECTION_REVIEWED_")) {
      const scopeKey = metadata?.scope_key;
      const sectionLabel = scopeKey
        ? (sectionLabelOverrides?.[String(scopeKey)] ?? getReviewTabLabel(String(scopeKey)))
        : "";
      return sectionLabel ? `${sectionLabel} ${actionLabel}` : actionLabel;
    }
    if (eventType.startsWith("ITEM_REVIEWED_")) {
      const scopeKey = (entityId ?? metadata?.scope_key) as string | undefined;
      const itemName = scopeKey ? formatItemLabelFromScopeKey(scopeKey) : "";
      return itemName ? `${itemName} ${actionLabel}` : actionLabel;
    }
    return actionLabel;
  }

  return eventType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTIVITY_PAGE_SIZE = 10;

/** Audit-only events: still stored in application_logs but hidden from the timeline UI. */
const TIMELINE_HIDDEN_EVENT_TYPES = new Set(["SIGNING_PACKAGE_COMPLETED"]);

function formatActivityText(activity: ApplicationLogEntry["activity"]): string | null {
  if (activity == null) return null;
  if (typeof activity === "string") return activity;
  if (typeof activity === "number" || typeof activity === "boolean") return String(activity);
  return JSON.stringify(activity);
}

function applicationLogToActivityCsvRow(
  log: ApplicationLogEntry,
  sectionLabelOverrides?: Record<string, string>
): AdminActivityCsvRow {
  const metadata = log.metadata;
  const actorRaw = metadata?.actorName ?? metadata?.organizationName;
  const actor =
    typeof actorRaw === "string" && actorRaw.trim() !== "" ? actorRaw : "";
  const portalRaw = metadata?.portal ?? metadata?.portalType;
  return {
    createdAt: log.created_at,
    event: getEventLabel(log.event_type, metadata, log.entityId, sectionLabelOverrides),
    eventType: log.event_type,
    actor,
    actorUserId: log.actor_id ?? "",
    portal: typeof portalRaw === "string" ? portalRaw : "",
    remark: log.remark ?? formatActivityText(log.activity) ?? "",
    metadata: mergeActivityCsvMetadata(metadata, {
      entityId: log.entityId,
      review_cycle: log.review_cycle,
      ip_address: log.ip_address,
    }),
  };
}

function ApplicationTimelineDetails({
  eventType,
  metadata,
  remark,
}: {
  eventType: string;
  metadata: ActivityMetadata | null;
  remark: string | null | undefined;
}) {
  const showOffer =
    eventType === "CONTRACT_OFFER_SENT" || eventType === "INVOICE_OFFER_SENT";
  const showRejection =
    (eventType === "CONTRACT_WITHDRAWN" || eventType === "INVOICE_OFFER_REJECTED") &&
    Boolean(metadata?.rejection_reason);
  const remarkLines = remark ? formatRemarkAsBullets(String(remark)) : [];

  if (!showOffer && !showRejection && remarkLines.length === 0) return null;

  return (
    <AdminTimelineDetailCard>
      <div className="space-y-3">
      {showOffer && metadata && eventType === "CONTRACT_OFFER_SENT" ? (
        <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 text-ui">
          {typeof metadata.offered_facility === "number" ? (
            <>
              <dt className="text-muted-foreground">Offered facility</dt>
              <dd className="tabular-nums">{formatCurrency(metadata.offered_facility)}</dd>
            </>
          ) : null}
          {typeof metadata.requested_facility === "number" ? (
            <>
              <dt className="text-muted-foreground">Requested facility</dt>
              <dd className="tabular-nums">{formatCurrency(metadata.requested_facility)}</dd>
            </>
          ) : null}
          {typeof metadata.acceptance_expires_at === "string" && metadata.acceptance_expires_at ? (
            <>
              <dt className="text-muted-foreground">Accept by</dt>
              <dd className="tabular-nums">
                {formatPhaseDeadlineAbsolute(metadata.acceptance_expires_at)}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {showOffer && metadata && eventType === "INVOICE_OFFER_SENT" ? (
        <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 text-ui">
          {typeof metadata.offered_amount === "number" ? (
            <>
              <dt className="text-muted-foreground">Financing amount</dt>
              <dd className="tabular-nums">{formatCurrency(metadata.offered_amount)}</dd>
            </>
          ) : null}
          {metadata.offered_ratio_percent != null ? (
            <>
              <dt className="text-muted-foreground">Financing ratio</dt>
              <dd className="tabular-nums">{Number(metadata.offered_ratio_percent)}%</dd>
            </>
          ) : null}
          {metadata.offered_profit_rate_percent != null ? (
            <>
              <dt className="text-muted-foreground">Profit rate</dt>
              <dd className="tabular-nums">{Number(metadata.offered_profit_rate_percent)}%</dd>
            </>
          ) : null}
          {typeof metadata.acceptance_expires_at === "string" && metadata.acceptance_expires_at ? (
            <>
              <dt className="text-muted-foreground">Accept by</dt>
              <dd className="tabular-nums">
                {formatPhaseDeadlineAbsolute(metadata.acceptance_expires_at)}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {showRejection && metadata?.rejection_reason ? (
        <div>
          <p className="text-meta text-muted-foreground">Reason</p>
          <p className="mt-0.5 text-ui leading-relaxed">{String(metadata.rejection_reason)}</p>
        </div>
      ) : null}
      {remarkLines.length > 0 ? (
        <div>
          <p className="text-meta text-muted-foreground">Remark</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ui leading-relaxed">
            {remarkLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      </div>
    </AdminTimelineDetailCard>
  );
}

export function AdminActivityTimeline({
  applicationId,
  productKey,
  reviewTabSections,
  sectionLabelOverrides,
  visibleReviewSections,
}: AdminActivityTimelineProps) {
  const { data, isLoading, error } = useApplicationLogs(applicationId);

  const logs: ApplicationLogEntry[] = React.useMemo(
    () => (data ?? []).filter((log) => !TIMELINE_HIDDEN_EVENT_TYPES.has(log.event_type)),
    [data]
  );

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [comparisonModalOpen, setComparisonModalOpen] = React.useState(false);
  const [comparisonContext, setComparisonContext] = React.useState<{
    reviewCycle: number;
    fieldChanges?: ResubmitFieldChangeItem[];
  } | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(ACTIVITY_PAGE_SIZE);

  React.useEffect(() => {
    setVisibleCount(ACTIVITY_PAGE_SIZE);
  }, [logs.length]);

  const visibleLogs = logs.slice(0, visibleCount);
  const hasMore = logs.length > visibleCount;
  const totalCount = logs.length;

  const csvRows = React.useMemo(
    () => (data ?? []).map((log) => applicationLogToActivityCsvRow(log, sectionLabelOverrides)),
    [data, sectionLabelOverrides]
  );

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <Card className="flex flex-col overflow-hidden rounded-2xl">
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
              fileName={`application-${applicationId ?? "activity"}-activity.csv`}
              rows={csvRows}
            />
          }
        />

        <CardContent className="min-h-0 overflow-hidden !px-0">
          {isLoading && (
            <div className="px-6 pb-12">
              <AdminVerticalTimelineSkeleton />
            </div>
          )}

          {error && (
            <div className="px-6 pb-12 text-ui text-destructive">Failed to load activity logs</div>
          )}

          {!isLoading && !error && logs.length === 0 && (
            <div className="px-6 py-8 pb-12 text-center text-ui text-muted-foreground">
              No activity logs found
            </div>
          )}

          {!isLoading && logs.length > 0 && (
            <ScrollArea className="overflow-auto">
              <div className="px-6">
                <AdminVerticalTimeline
                  footer={
                    hasMore ? (
                      <div className="mt-3 flex justify-center border-t border-border pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setVisibleCount((prev) => Math.min(prev + ACTIVITY_PAGE_SIZE, logs.length))
                          }
                        >
                          <ChevronDownIcon className="mr-1.5 h-4 w-4" aria-hidden />
                          Show more ({logs.length - visibleCount} remaining)
                        </Button>
                      </div>
                    ) : null
                  }
                >
                  {visibleLogs.map((log) => {
                    const eventType = log.event_type;
                    const metadata = log.metadata as ActivityMetadata | null;
                    const actorRaw = metadata
                      ? (metadata.actorName ?? metadata.organizationName)
                      : undefined;
                    const portal =
                      metadata?.portal || metadata?.portalType
                        ? String(metadata.portal || metadata.portalType)
                        : null;
                    const actorName = resolveAdminTimelineActorLabel({
                      actorName: typeof actorRaw === "string" ? actorRaw : null,
                      actorUserId: log.actor_id,
                      portal,
                    });
                    const remark = log.remark;
                    const entityId = log.entityId ?? undefined;
                    const resubmitChanges =
                      eventType === "APPLICATION_RESUBMITTED"
                        ? metadata?.resubmit_changes
                        : undefined;
                    const reviewCycleFromLog =
                      typeof (log as { review_cycle?: unknown }).review_cycle === "number"
                        ? (log as { review_cycle: number }).review_cycle
                        : null;
                    const canOpenResubmitComparison =
                      eventType === "APPLICATION_RESUBMITTED" &&
                      reviewCycleFromLog != null &&
                      reviewCycleFromLog >= 2;

                    const tabsOnly =
                      eventType === "APPLICATION_RESUBMITTED" && resubmitChanges?.field_changes
                        ? formatResubmitTabsOnlyActivity({
                            resubmitChanges: resubmitChanges as ResubmitChangesMetadata | undefined,
                            sectionLabelOverrides,
                          })
                        : null;
                    const description = tabsOnly ?? formatActivityText(log.activity);
                    const canExpand = Boolean(
                      remark ||
                        ((eventType === "CONTRACT_OFFER_SENT" || eventType === "INVOICE_OFFER_SENT") &&
                          metadata) ||
                        ((eventType === "CONTRACT_WITHDRAWN" ||
                          eventType === "INVOICE_OFFER_REJECTED") &&
                          metadata?.rejection_reason)
                    );

                    return (
                      <AdminVerticalTimelineItem
                        key={log.id}
                        title={getEventLabel(eventType, metadata, entityId, sectionLabelOverrides)}
                        description={description}
                        descriptionClassName={
                          eventType === "APPLICATION_RESUBMITTED" && !tabsOnly
                            ? "whitespace-pre-line"
                            : "line-clamp-2"
                        }
                        createdAt={log.created_at}
                        actorLabel={actorName}
                        portal={portal}
                        timestampActions={
                          canOpenResubmitComparison || canExpand ? (
                            <>
                              {canOpenResubmitComparison ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setComparisonContext({
                                      reviewCycle: reviewCycleFromLog!,
                                      fieldChanges: Array.isArray(resubmitChanges?.field_changes)
                                        ? (resubmitChanges!.field_changes as ResubmitFieldChangeItem[])
                                        : undefined,
                                    });
                                    setComparisonModalOpen(true);
                                  }}
                                  className="hover:text-foreground hover:underline"
                                >
                                  View comparison
                                </button>
                              ) : null}
                              {canExpand ? (
                                <button
                                  type="button"
                                  onClick={() => toggle(log.id)}
                                  className="hover:text-foreground hover:underline"
                                >
                                  {expanded[log.id] ? "Hide details" : "View details"}
                                </button>
                              ) : null}
                            </>
                          ) : undefined
                        }
                        footer={
                          expanded[log.id] ? (
                            <ApplicationTimelineDetails
                              eventType={eventType}
                              metadata={metadata}
                              remark={remark}
                            />
                          ) : null
                        }
                      />
                    );
                  })}
                </AdminVerticalTimeline>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      <ResubmitComparisonModal
        open={comparisonModalOpen}
        onOpenChange={(o) => {
          setComparisonModalOpen(o);
          if (!o) setComparisonContext(null);
        }}
        applicationId={applicationId}
        productKey={productKey ?? null}
        reviewCycle={comparisonContext?.reviewCycle ?? null}
        fieldChanges={comparisonContext?.fieldChanges}
        reviewTabSections={reviewTabSections}
        visibleReviewSections={visibleReviewSections}
      />
    </>
  );
}

export default AdminActivityTimeline;
