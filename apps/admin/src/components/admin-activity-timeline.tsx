 "use client";

/**
 * Guide: docs/guides/admin/activity-timeline.md — Event labels, icons, colors for activity timeline display
 *
 * Imports
 *
 * What this section does:
 * - Imports React and UI primitives used by the timeline component.
 *
 * Why it exists:
 * - Required dependencies for rendering the activity timeline.
 *
 * Data shapes:
 * - Expects activity items with fields: id, event_type, metadata?, created_at, activity?, ip_address?
 */

/**
 * CHANGE SUMMARY
 *
 * - Switched data source: component now fetches only application-scoped logs via `useApplicationLogs`.
 * - Updated prop: `applicationId` replaces `organizationId`.
 * - Updated total badge to reflect application log count.
 * - Removed cross-adapter pagination controls (no infinite query).
 *
 * Pros:
 * - Shows only application-specific events, matching intent.
 * - Simpler count (accurate for application-level logs).
 *
 * Cons:
 * - Loses aggregated organization-level events.
 * - Pagination now depends on server endpoint; UI no longer paginates client-side.
 */

 import * as React from "react";
 import { Badge } from "@/components/ui/badge";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Skeleton } from "@cashsouk/ui";
 import { useApplicationLogs } from "@/hooks/use-application-logs";
 import { formatDistanceToNow, format } from "date-fns";
import {
  ChevronDownIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  UserIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
  ClipboardDocumentCheckIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { formatRemarkAsBullets } from "@/lib/utils";
import { getReviewTabLabel } from "@/components/application-review/review-registry";
import { formatCurrency } from "@cashsouk/config";

type ResubmitFieldChangeItem = {
  path: string;
  section_key: string;
  section_label: string;
  field_label?: string;
  previous_value?: string;
  next_value?: string;
};

function isCompactResubmitScalarDisplay(a: string, b: string): boolean {
  const maxLen = 52;
  if (a.length > maxLen || b.length > maxLen) return false;
  if (a.includes("\n") || b.includes("\n")) return false;
  if (a.startsWith("{") || b.startsWith("{")) return false;
  if (a.startsWith("[") || b.startsWith("[")) return false;
  return true;
}

/** Ops-facing label only — never show raw JSON paths in the UI. */
function resubmitChangeFieldTitle(fc: ResubmitFieldChangeItem): string {
  if (fc.field_label && fc.field_label.trim().length > 0) {
    return fc.field_label.trim();
  }
  const segments = fc.path.split(/[.[\]]/).filter((s) => s.length > 0);
  const nonNumeric = segments.filter((s) => !/^\d+$/.test(s));
  const leaf = nonNumeric.length > 0 ? nonNumeric[nonNumeric.length - 1]! : "Field";
  return leaf
    .split("_")
    .map((w) =>
      w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
}

type ResubmitChangesMetadata = {
  section_keys?: string[];
  section_labels?: string[];
  contract_updated?: boolean;
  invoices_updated?: boolean;
  activity_summary?: string;
  field_changes?: ResubmitFieldChangeItem[];
};

type ActivityMetadata = {
  scope_key?: string;
  entityId?: string;
  remark?: string;
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
  rejection_reason?: string;
  resubmit_changes?: ResubmitChangesMetadata;
};

function formatItemLabelFromScopeKey(scopeKey: string): string {
  if (!scopeKey) return "Item";

  const parts = scopeKey.split(":");
  const lastPart = parts[parts.length - 1] ?? "";

  if (
    scopeKey.startsWith("invoice_details:") ||
    scopeKey.startsWith("invoice:")
  ) {
    return lastPart ? `Invoice ${lastPart}` : "Invoice";
  }

  if (
    scopeKey.startsWith("supporting_documents:") ||
    scopeKey.startsWith("document:")
  ) {
    if (!lastPart) return "Document";
    return lastPart
      .replace(/_/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((word) =>
        word.length > 1 && word === word.toUpperCase()
          ? word
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(" ");
  }

  return "Item";
}

/**
 * Component props
 *
 * What this section does:
 * - Defines the props for the AdminActivityTimeline component.
 *
 * Why it exists:
 * - The timeline now fetches logs scoped to a single application.
 *
 * Data shape:
 * - applicationId: string | null
 */
interface AdminActivityTimelineProps {
  applicationId: string | null;
  /** Override section labels for display (e.g. contract_details → "Customer" for invoice_only). */
  sectionLabelOverrides?: Record<string, string>;
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "APPLICATION_CREATED":
      return <PlayIcon className="h-3.5 w-3.5 text-blue-600" />;
    case "APPLICATION_SUBMITTED":
    case "APPLICATION_RESUBMITTED":
      return <ArrowPathIcon className="h-3.5 w-3.5 text-blue-500" />;
    case "SECTION_REVIEWED_APPROVED":
    case "ITEM_REVIEWED_APPROVED":
    case "APPLICATION_APPROVED":
    case "APPLICATION_COMPLETED":
      return <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />;
    case "SECTION_REVIEWED_REJECTED":
    case "ITEM_REVIEWED_REJECTED":
    case "APPLICATION_REJECTED":
      return <XCircleIcon className="h-3.5 w-3.5 text-destructive" />;
    case "SECTION_REVIEWED_AMENDMENT_REQUESTED":
    case "ITEM_REVIEWED_AMENDMENT_REQUESTED":
    case "AMENDMENTS_SUBMITTED":
      return <DocumentTextIcon className="h-3.5 w-3.5 text-amber-600" />;
    case "SECTION_REVIEWED_PENDING":
    case "ITEM_REVIEWED_PENDING":
    case "APPLICATION_RESET_TO_UNDER_REVIEW":
      return <ArrowPathIcon className="h-3.5 w-3.5 text-muted-foreground" />;
    case "CONTRACT_OFFER_SENT":
    case "INVOICE_OFFER_SENT":
    case "CONTRACT_OFFER_ACCEPTED":
    case "INVOICE_OFFER_ACCEPTED":
      return <PaperAirplaneIcon className="h-3.5 w-3.5 text-blue-500" />;
    case "CONTRACT_OFFER_REJECTED":
    case "INVOICE_OFFER_REJECTED":
    case "CONTRACT_OFFER_RETRACTED":
    case "INVOICE_OFFER_RETRACTED":
    case "CONTRACT_WITHDRAWN":
    case "APPLICATION_WITHDRAWN":
    case "INVOICE_WITHDRAWN":
      return <XCircleIcon className="h-3.5 w-3.5 text-muted-foreground" />;
    case "OFFER_EXPIRED":
      return <ClockIcon className="h-3.5 w-3.5 text-amber-600" />;
    default:
      return <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />;
  }
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
    CONTRACT_OFFER_SENT: "Contract Offer Sent",
    CONTRACT_OFFER_ACCEPTED: "Contract Offer Accepted",
    CONTRACT_OFFER_REJECTED: "Contract Offer Withdrawn",
    CONTRACT_OFFER_RETRACTED: "Contract Offer Retracted",
    CONTRACT_WITHDRAWN: "Contract Offer Withdrawn",
    INVOICE_OFFER_SENT: "Invoice Offer Sent",
    INVOICE_OFFER_ACCEPTED: "Invoice Offer Accepted",
    INVOICE_OFFER_REJECTED: "Invoice Offer Rejected",
    INVOICE_OFFER_RETRACTED: "Invoice Offer Retracted",
    INVOICE_WITHDRAWN: "Invoice Withdrawn",
    OFFER_EXPIRED: "Offer Expired",
    AMENDMENTS_SUBMITTED: "Amendment Request Sent",
  };
  if (eventType === "INVOICE_OFFER_SENT") {
    const invoiceNumber = metadata?.invoice_number;
    return invoiceNumber != null && invoiceNumber !== ""
      ? `Invoice ${invoiceNumber} Offer Sent`
      : "Invoice Offer Sent";
  }
  if (eventType === "INVOICE_OFFER_ACCEPTED") {
    const invoiceNumber = metadata?.invoice_number;
    return invoiceNumber != null && invoiceNumber !== ""
      ? `Invoice ${invoiceNumber} Offer Accepted`
      : "Invoice Offer Accepted";
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

function getEventDotColor(eventType: string): string {
  switch (eventType) {
    case "SECTION_REVIEWED_APPROVED":
    case "ITEM_REVIEWED_APPROVED":
    case "APPLICATION_APPROVED":
    case "APPLICATION_COMPLETED":
      return "bg-emerald-500";
    case "SECTION_REVIEWED_REJECTED":
    case "ITEM_REVIEWED_REJECTED":
    case "APPLICATION_REJECTED":
      return "bg-destructive";
    case "SECTION_REVIEWED_AMENDMENT_REQUESTED":
    case "ITEM_REVIEWED_AMENDMENT_REQUESTED":
    case "AMENDMENTS_SUBMITTED":
      return "bg-amber-500";
    case "SECTION_REVIEWED_PENDING":
    case "ITEM_REVIEWED_PENDING":
    case "APPLICATION_RESET_TO_UNDER_REVIEW":
      return "bg-muted-foreground";
    case "APPLICATION_WITHDRAWN":
    case "INVOICE_WITHDRAWN":
    case "CONTRACT_OFFER_REJECTED":
    case "INVOICE_OFFER_REJECTED":
    case "CONTRACT_OFFER_RETRACTED":
    case "INVOICE_OFFER_RETRACTED":
    case "CONTRACT_WITHDRAWN":
      return "bg-muted-foreground";
    case "OFFER_EXPIRED":
      return "bg-amber-500";
    case "CONTRACT_OFFER_SENT":
    case "INVOICE_OFFER_SENT":
    case "CONTRACT_OFFER_ACCEPTED":
    case "INVOICE_OFFER_ACCEPTED":
      return "bg-blue-500";
    default:
      return "bg-muted-foreground";
  }
}

const ACTIVITY_PAGE_SIZE = 10;

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

export function AdminActivityTimeline({ applicationId, sectionLabelOverrides }: AdminActivityTimelineProps) {
  /**
   * Local state / hooks
   *
   * What this section does:
   * - Fetches application-scoped logs via `useApplicationLogs`.
   *
   * Why it exists:
   * - The UI should only render application-level activity (not organization-wide aggregated logs).
   *
   * Data shape:
   * - `data` is an array of logs with fields similar to UnifiedActivity.
   */
  const { data, isLoading, error } = useApplicationLogs(applicationId);

  // Flattened logs (useApplicationLogs returns an array)
  // Cast to any[] because server hook returns a minimal shape; UI reads optional fields.
  const logs: any[] = React.useMemo(() => data ?? [], [data]) as any[];

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = React.useState(ACTIVITY_PAGE_SIZE);

  React.useEffect(() => {
    setVisibleCount(ACTIVITY_PAGE_SIZE);
  }, [logs.length]);

  const visibleLogs = logs.slice(0, visibleCount);
  const hasMore = logs.length > visibleCount;

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Total count updated to reflect only application-scoped logs
  const totalCount = logs.length;

  function getRemarkVariant(eventType: string) {
    const t = eventType.toUpperCase();

    if (t.includes("APPROVED"))
      return "bg-emerald-50 border-emerald-200 text-emerald-900";

    if (t.includes("REJECTED"))
      return "bg-red-50 border-red-200 text-red-900";

    if (t.includes("AMENDMENT"))
      return "bg-amber-50 border-amber-200 text-amber-900";

    return "bg-muted/40 border-border text-foreground";
  }

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
          Application events and status changes
        </p>
      </CardHeader>

      <CardContent className="overflow-hidden min-h-0 !px-0 ">
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
          <ScrollArea className="overflow-auto">
              <div className="px-6 ">
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-5">
                    {visibleLogs.map((log, index) => {
                      const eventType = log.event_type;
                      const isFirst = index === 0;
                      const actorName = (log.metadata && (log.metadata.actorName || log.metadata.organizationName)) || "System";
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const metadata = log.metadata as ActivityMetadata | null;
                      // Prefer canonical top-level fields only.
                      // Server stores remark/entity_id at top-level. Do NOT read from metadata.
                      const remark = (log as any).remark;
                      const entityId = (log as any).entityId ?? undefined;
                      const resubmitChanges =
                        eventType === "APPLICATION_RESUBMITTED"
                          ? metadata?.resubmit_changes
                          : undefined;
                      const hasResubmitChangeDetail =
                        resubmitChanges != null && typeof resubmitChanges === "object";
                      const resubmitFieldCount = Array.isArray(resubmitChanges?.field_changes)
                        ? resubmitChanges.field_changes.length
                        : 0;
                      const showResubmitSectionList =
                        Array.isArray(resubmitChanges?.section_labels) &&
                        resubmitChanges.section_labels.length > 0 &&
                        resubmitFieldCount === 0;

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
                                {getEventLabel(eventType, metadata, entityId, sectionLabelOverrides)}
                              </span>
                            </div>

                            {/* Activity text — hide resubmit summary when details are open (card repeats the same section names). */}
                            {log.activity &&
                              !(
                                eventType === "APPLICATION_RESUBMITTED" &&
                                expanded[log.id] &&
                                hasResubmitChangeDetail
                              ) && (
                                <p
                                  className={`text-xs text-muted-foreground mt-0.5 ${
                                    eventType === "APPLICATION_RESUBMITTED" ? "" : "line-clamp-2"
                                  }`}
                                >
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

                            {/* Timestamp */}
                            <div className="flex items-center gap-3 mt-1">
                              <p
                                className="text-[11px] text-muted-foreground/70"
                                title={format(new Date(log.created_at), "PPpp")}
                              >
                                {formatDistanceToNow(new Date(log.created_at), {
                                  addSuffix: true,
                                })}
                              </p>

                              {(remark ||
                                hasResubmitChangeDetail ||
                                ((eventType === "CONTRACT_OFFER_SENT" || eventType === "INVOICE_OFFER_SENT") && metadata) ||
                                ((eventType === "CONTRACT_WITHDRAWN" || eventType === "INVOICE_OFFER_REJECTED") &&
                                  metadata?.rejection_reason)) && (
                                <button
                                  onClick={() => toggle(log.id)}
                                  className="text-xs text-foreground/80 hover:underline"
                                >
                                  {expanded[log.id] ? "Hide details" : "View details"}
                                </button>
                              )}
                            </div>

                            {/* Offer details (CONTRACT_OFFER_SENT / INVOICE_OFFER_SENT) */}
                            {expanded[log.id] && (eventType === "CONTRACT_OFFER_SENT" || eventType === "INVOICE_OFFER_SENT") && metadata && (
                              <div className="mt-3 rounded-xl border bg-muted/20 p-4 text-[11px] space-y-2">
                                {eventType === "CONTRACT_OFFER_SENT" && (
                                  <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
                                    {typeof metadata.offered_facility === "number" && (
                                      <>
                                        <dt className="text-muted-foreground">Offered facility</dt>
                                        <dd className="font-medium tabular-nums">{formatCurrency(metadata.offered_facility)}</dd>
                                      </>
                                    )}
                                    {typeof metadata.requested_facility === "number" && (
                                      <>
                                        <dt className="text-muted-foreground">Requested facility</dt>
                                        <dd className="tabular-nums">{formatCurrency(metadata.requested_facility)}</dd>
                                      </>
                                    )}
                                  </dl>
                                )}
                                {eventType === "INVOICE_OFFER_SENT" && (
                                  <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
                                    {typeof metadata.offered_amount === "number" && (
                                      <>
                                        <dt className="text-muted-foreground">Financing Amount</dt>
                                        <dd className="font-medium tabular-nums">{formatCurrency(metadata.offered_amount)}</dd>
                                      </>
                                    )}
                                    {metadata.offered_ratio_percent != null && (
                                      <>
                                        <dt className="text-muted-foreground">Financing Ratio</dt>
                                        <dd className="tabular-nums">{Number(metadata.offered_ratio_percent)}%</dd>
                                      </>
                                    )}
                                    {metadata.offered_profit_rate_percent != null && (
                                      <>
                                        <dt className="text-muted-foreground">Profit rate</dt>
                                        <dd className="tabular-nums">{Number(metadata.offered_profit_rate_percent)}%</dd>
                                      </>
                                    )}
                                  </dl>
                                )}
                              </div>
                            )}

                            {expanded[log.id] &&
                              (eventType === "CONTRACT_WITHDRAWN" || eventType === "INVOICE_OFFER_REJECTED") &&
                              metadata?.rejection_reason && (
                                <div className="mt-3 rounded-xl border bg-muted/20 p-4 text-[11px] space-y-2">
                                  <p className="text-[11px] font-bold">Reason</p>
                                  <p className="text-[11px] font-normal text-foreground leading-relaxed">
                                    {String(metadata.rejection_reason)}
                                  </p>
                                </div>
                              )}

                            {expanded[log.id] &&
                              eventType === "APPLICATION_RESUBMITTED" &&
                              hasResubmitChangeDetail && (
                                <div className="mt-3 rounded-xl border bg-muted/20 p-4 text-[11px] space-y-2">
                                  <p className="text-[11px] font-semibold text-foreground">
                                    Compared to last submission
                                  </p>

                                  {showResubmitSectionList &&
                                    Array.isArray(resubmitChanges.section_labels) && (
                                    <div>
                                      <p className="text-[11px] text-muted-foreground mb-1">
                                        Pages / sections touched
                                      </p>
                                      <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-foreground/90">
                                        {resubmitChanges.section_labels.map((label, i) => (
                                          <li key={`${label}-sum-${i}`}>{label}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {Array.isArray(resubmitChanges.field_changes) &&
                                  resubmitChanges.field_changes.length > 0 ? (
                                    <div>
                                      <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                                        {(
                                          Object.entries(
                                            resubmitChanges.field_changes.reduce<
                                              Record<string, ResubmitFieldChangeItem[]>
                                            >((acc, fc) => {
                                              const k = fc.section_label || fc.section_key;
                                              if (!acc[k]) acc[k] = [];
                                              acc[k].push(fc);
                                              return acc;
                                            }, {})
                                          ) as [string, ResubmitFieldChangeItem[]][]
                                        ).map(([sectionLabel, items]) => (
                                          <div
                                            key={sectionLabel}
                                            className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 space-y-2"
                                          >
                                            <p className="text-[11px] font-semibold text-foreground">
                                              {sectionLabel}
                                            </p>
                                            <div className="space-y-2">
                                              {items.map((fc, idx) => {
                                                const prev =
                                                  fc.previous_value != null
                                                    ? String(fc.previous_value)
                                                    : null;
                                                const next =
                                                  fc.next_value != null ? String(fc.next_value) : null;
                                                const hasPair = prev != null && next != null;
                                                const title = resubmitChangeFieldTitle(fc);
                                                const compact =
                                                  hasPair &&
                                                  isCompactResubmitScalarDisplay(prev, next);

                                                return (
                                                  <div
                                                    key={`${fc.path}-${idx}`}
                                                    className="border-b border-border/40 pb-2 last:border-0 last:pb-0"
                                                  >
                                                    <p className="text-[11px] font-semibold text-foreground mb-1">
                                                      {title}
                                                    </p>
                                                    {!hasPair ? (
                                                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                        Values are not available for this older log entry.
                                                      </p>
                                                    ) : compact ? (
                                                      <div className="flex flex-wrap items-center gap-1.5">
                                                        <Badge
                                                          variant="secondary"
                                                          className="text-[11px] font-normal font-sans line-through opacity-90 max-w-full sm:max-w-[min(100%,18rem)] whitespace-normal break-words text-left h-auto py-1 px-2"
                                                        >
                                                          {prev}
                                                        </Badge>
                                                        <ArrowRightIcon
                                                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                                          aria-hidden
                                                        />
                                                        <Badge
                                                          variant="default"
                                                          className="text-[11px] font-normal font-sans max-w-full sm:max-w-[min(100%,18rem)] whitespace-normal break-words text-left h-auto py-1 px-2"
                                                        >
                                                          {next}
                                                        </Badge>
                                                      </div>
                                                    ) : (
                                                      <div className="space-y-2">
                                                        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                                                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                                            Before
                                                          </p>
                                                          <p className="text-[11px] leading-relaxed text-foreground/85 whitespace-pre-wrap break-words line-through decoration-foreground/45">
                                                            {prev}
                                                          </p>
                                                        </div>
                                                        <div className="flex justify-center">
                                                          <ArrowRightIcon
                                                            className="h-3.5 w-3.5 text-muted-foreground"
                                                            aria-hidden
                                                          />
                                                        </div>
                                                        <div className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2">
                                                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                                            After
                                                          </p>
                                                          <p className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
                                                            {next}
                                                          </p>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    !(
                                      Array.isArray(resubmitChanges.section_labels) &&
                                      resubmitChanges.section_labels.length > 0
                                    ) && (
                                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        No differences were detected when comparing to the previous revision
                                        snapshot.
                                      </p>
                                    )
                                  )}
                                </div>
                              )}

                          {expanded[log.id] && remark && (
                            <div className="mt-3 rounded-xl border p-4 text-[11px] space-y-3">

                              {/* Remark */}
                              <div className="space-y-2">
                                <p className="text-[11px] font-semibold text-foreground">
                                  Remark
                                </p>
                                <div
                                  className={`rounded-lg border px-4 py-3 leading-relaxed ${getRemarkVariant(
                                    log.event_type
                                  )}`}
                                >
                                  {(() => {
                                    const lines = formatRemarkAsBullets(String(remark));
                                    if (lines.length === 0) return null;
                                    return (
                                      <ul className="list-disc pl-5 space-y-1.5 text-[11px]">
                                        {lines.map((line, i) => (
                                          <li key={i} className="pl-0.5 text-[11px]">
                                            {line}
                                          </li>
                                        ))}
                                      </ul>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {hasMore && (
                    <div className="mt-3 flex justify-center border-t border-border pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setVisibleCount((prev) =>
                            Math.min(prev + ACTIVITY_PAGE_SIZE, logs.length)
                          )
                        }
                      >
                        <ChevronDownIcon className="mr-1.5 h-4 w-4" aria-hidden />
                        Show more ({logs.length - visibleCount} remaining)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminActivityTimeline;

