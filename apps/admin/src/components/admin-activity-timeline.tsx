 "use client";

/** 
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
  ClockIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  PlayIcon,
  UserIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";

type ActivityMetadata = {
  entityId?: string;
  remark?: string;
  portal?: string;
  portalType?: string;
  device_type?: string;
  device_info?: string;
};

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

export function AdminActivityTimeline({ applicationId }: AdminActivityTimelineProps) {
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
            <CardTitle className="text-base font-semibold">Application Activity</CardTitle>
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
                    {logs.map((log, index) => {
                      const eventType = log.event_type;
                      const isFirst = index === 0;
                      const actorName = (log.metadata && (log.metadata.actorName || log.metadata.organizationName)) || "System";
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const metadata = log.metadata as ActivityMetadata | null;

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

                            {/* IP address (may be undefined depending on the application logs payload) */}
                            {log.ip_address && (
                              <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">
                                {log.ip_address}
                              </p>
                            )}

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

                              {(metadata?.remark || metadata?.entityId) && (
                                <button
                                  onClick={() => toggle(log.id)}
                                  className="text-xs text-foreground/80 hover:underline"
                                >
                                  {expanded[log.id] ? "Hide details" : "View details"}
                                </button>
                              )}
                            </div>

{expanded[log.id] && (
  <div className="mt-3 rounded-xl border p-3 text-sm space-y-3">
    
    {/* Entity context (invoice/doc only) */}
    {metadata?.entityId && (
      <div>
        <p className="text-xs font-semibold mb-1 text-foreground">
          {log.event_type.startsWith("INVOICE_")
            ? "Invoice"
            : log.event_type.startsWith("DOCUMENT_")
            ? "Document"
            : "Entity"}
        </p>
        <div className="text-xs text-muted-foreground">
          {String(metadata.entityId)}
        </div>
      </div>
    )}

    {/* Remark */}
    {metadata?.remark && (
      <div>
        <p className="text-xs font-semibold mb-1 text-foreground">
          Remark
        </p>
        <div
          className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${getRemarkVariant(
            log.event_type
          )}`}
        >
          {String(metadata.remark)}
        </div>
      </div>
    )}
  </div>
)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminActivityTimeline;

