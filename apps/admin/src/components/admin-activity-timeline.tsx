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
  AdminVerticalTimeline,
  AdminVerticalTimelineItem,
  AdminVerticalTimelineSkeleton,
} from "@/components/admin-vertical-timeline";
import { resolveAdminTimelineActorLabel } from "@/components/admin-timeline-originator";
import { ChevronDownIcon, ClockIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { getReviewTabLabel } from "@/components/application-review/review-registry";
import { formatApplicationReference, getItemDisplayNameFromScopeKey } from "@cashsouk/types";
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
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { applicationLogToAuditDetail } from "@/components/audit/audit-adapters";

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
  applicationDisplayReference?: string | null;
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
  SECTION_REVIEWED_OFFER_SENT: "Offer Sent",
  SECTION_REVIEWED_OFFER_EXPIRED: "Offer Expired",
  SECTION_REVIEWED_WITHDRAWN: "Withdrawn",
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
    APPLICATION_PROCESSING_FEE_PAID: "Application Processing Fee Paid",
    FACILITY_FEE_PAID: "Facility Fee Paid",
    APPLICATION_SUBMITTED: "Application Submitted",
    APPLICATION_RESUBMITTED: "Application Resubmitted",
    APPLICATION_APPROVED: "Application Approved",
    APPLICATION_REJECTED: "Application Rejected",
    APPLICATION_WITHDRAWN: "Application Withdrawn",
    APPLICATION_COMPLETED: "Application Completed",
    APPLICATION_RESET_TO_UNDER_REVIEW: "Application Returned to Review",
    CONTRACT_OFFER_SENT: "Facility Offer Sent",
    CONTRACT_OFFER_ACCEPTANCE_SUBMITTED: "Facility Offer Acceptance Submitted",
    CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED: "Facility Offer Acceptance Resubmitted",
    CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING: "Facility Acceptance Approved for Signing",
    CONTRACT_OFFER_ACCEPTED: "Facility Offer Accepted",
    CONTRACT_OFFER_REJECTED: "Facility Offer Withdrawn",
    CONTRACT_OFFER_RETRACTED: "Facility Offer Retracted",
    CONTRACT_FACILITY_OCCUPANCY_UPDATED: "Facility Occupancy Updated",
    CONTRACT_OFFER_EXPIRED: "Facility Offer Expired",
    CONTRACT_SIGNING_DEADLINE_EXTENDED: "Signing Deadline Extended",
    CONTRACT_OFFER_DECLINED: "Facility Offer Declined",
    INVOICE_OFFER_SENT: "Invoice Offer Sent",
    INVOICE_OFFER_ACCEPTANCE_SUBMITTED: "Invoice Offer Acceptance Submitted",
    INVOICE_OFFER_ACCEPTANCE_RESUBMITTED: "Invoice Offer Acceptance Resubmitted",
    INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING: "Invoice Acceptance Approved for Signing",
    INVOICE_OFFER_ACCEPTED: "Invoice Offer Accepted",
    INVOICE_OFFER_REJECTED: "Invoice Offer Declined",
    INVOICE_OFFER_RETRACTED: "Invoice Offer Retracted",
    INVOICE_OFFER_EXPIRED: "Invoice Offer Expired",
    INVOICE_SIGNING_DEADLINE_EXTENDED: "Signing Deadline Extended",
    INVOICE_WITHDRAWN: "Invoice Withdrawn",
    SIGNING_PACKAGE_CREATED: "Signing Package Created",
    SIGNING_PACKAGE_SENT: "Signing Package Sent",
    SIGNING_PACKAGE_COMPLETED: "Signing Package Completed",
    SIGNING_PACKAGE_DECLINED: "Signing Package Declined",
    SIGNING_PACKAGE_EXPIRED: "Signing Package Expired",
    SIGNING_PACKAGE_VOIDED: "Signing Package Voided",
    AMENDMENTS_SUBMITTED: "Amendment Request Sent",
    CONTRACT_FACILITY_FEE_WAIVED: "Facility Fee Waived",
    CONTRACT_FACILITY_DISABLED: "Facility Disabled",
    CONTRACT_FACILITY_ENABLED: "Facility Enabled",
    CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED: "Large Private Customer Flag Updated",
    PAYMASTER_CREATED: "Paymaster Created",
    PAYMASTER_LINKED_TO_ISSUER: "Paymaster Linked to Issuer",
    PAYMASTER_VERIFIED: "Paymaster Identity Verified",
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
      ? `Invoice ${invoiceNumber} Offer Accepted`
      : "Invoice Offer Accepted";
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

function formatActivityText(activity: ApplicationLogEntry["activity"]): string | null {
  if (activity == null) return null;
  if (typeof activity === "string") return activity;
  if (typeof activity === "number" || typeof activity === "boolean") return String(activity);
  return JSON.stringify(activity);
}

function paymasterIdentityDescription(
  eventType: string,
  metadata?: Record<string, unknown> | null,
  remark?: string | null
): string | null {
  if (remark?.trim()) return remark.trim();
  if (!eventType.startsWith("PAYMASTER_")) return null;
  const legalName = typeof metadata?.legalName === "string" ? metadata.legalName.trim() : "";
  const registrationNumber =
    typeof metadata?.registrationNumber === "string" ? metadata.registrationNumber.trim() : "";
  const identity = [legalName, registrationNumber ? `(${registrationNumber})` : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (eventType === "PAYMASTER_CREATED") {
    return identity ? `${identity} created as Unverified.` : "Paymaster master created as Unverified.";
  }
  if (eventType === "PAYMASTER_LINKED_TO_ISSUER") {
    return identity ? `${identity} linked to this issuer.` : "Existing Paymaster linked to this issuer.";
  }
  if (eventType === "PAYMASTER_VERIFIED") {
    return identity
      ? `${identity} identity reviewed internally. Unverified → Verified.`
      : "Paymaster identity reviewed internally. Unverified → Verified.";
  }
  return identity || null;
}

function paymasterIdentityCompactDetails(
  eventType: string,
  metadata?: Record<string, unknown> | null
): { label: string; value: string }[] {
  if (!eventType.startsWith("PAYMASTER_")) return [];
  const rows: { label: string; value: string }[] = [];
  const legalName = typeof metadata?.legalName === "string" ? metadata.legalName.trim() : "";
  const registrationNumber =
    typeof metadata?.registrationNumber === "string" ? metadata.registrationNumber.trim() : "";
  const status =
    typeof metadata?.verification_status === "string" ? metadata.verification_status.trim() : "";
  const previousStatus =
    typeof metadata?.previous_status === "string" ? metadata.previous_status.trim() : "";
  const newStatus = typeof metadata?.new_status === "string" ? metadata.new_status.trim() : "";
  if (legalName) rows.push({ label: "Legal name", value: legalName });
  if (registrationNumber) rows.push({ label: "SSM", value: registrationNumber });
  if (previousStatus && newStatus) {
    rows.push({ label: "Status", value: `${previousStatus} → ${newStatus}` });
  } else if (status) {
    rows.push({ label: "Status", value: status });
  }
  return rows;
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
    actorType: log.actor_type,
    source: log.source ?? (typeof portalRaw === "string" ? portalRaw : null),
    targetType: log.target_type,
    targetReference: log.target_id ?? log.entityId,
    correlationId: log.correlation_id,
  };
}

export function AdminActivityTimeline({
  applicationId,
  applicationDisplayReference,
  productKey,
  reviewTabSections,
  sectionLabelOverrides,
  visibleReviewSections,
}: AdminActivityTimelineProps) {
  const { data, isLoading, error } = useApplicationLogs(applicationId);

  const logs: ApplicationLogEntry[] = data ?? [];

  const [selectedLog, setSelectedLog] = React.useState<ApplicationLogEntry | null>(null);
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
              fileName={`application-${formatApplicationReference({
                displayReference: applicationDisplayReference,
                id: applicationId,
              }).replace(/[^A-Z0-9-]/gi, "") || "activity"}-activity.csv`}
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
                    const description =
                      tabsOnly ??
                      paymasterIdentityDescription(eventType, metadata, log.remark) ??
                      formatActivityText(log.activity);

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
                        compactDetails={paymasterIdentityCompactDetails(eventType, metadata)}
                        onViewDetails={() => setSelectedLog(log)}
                        timestampActions={
                          canOpenResubmitComparison ? (
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
                          ) : undefined
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
      <AuditDetailDrawer
        open={selectedLog != null}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null);
        }}
        record={
          selectedLog
            ? applicationLogToAuditDetail(
                selectedLog,
                getEventLabel(
                  selectedLog.event_type,
                  selectedLog.metadata,
                  selectedLog.entityId,
                  sectionLabelOverrides
                ),
                paymasterIdentityDescription(
                  selectedLog.event_type,
                  selectedLog.metadata,
                  selectedLog.remark
                ) ?? formatActivityText(selectedLog.activity)
              )
            : null
        }
      />
      <ResubmitComparisonModal
        open={comparisonModalOpen}
        onOpenChange={(o) => {
          setComparisonModalOpen(o);
          if (!o) setComparisonContext(null);
        }}
        applicationId={applicationId}
        applicationDisplayReference={applicationDisplayReference}
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
