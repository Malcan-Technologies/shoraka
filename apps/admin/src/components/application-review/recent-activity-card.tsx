"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import AdminActivityTimeline from "@/components/admin-activity-timeline";
import { formatRemarkAsBullets } from "@/lib/utils";

export interface RecentActivityCardProps {
  /** Same shape as main review tabs — drives status dots in resubmit comparison modal. */
  reviewTabSections?: { section: string; status: string }[];
  events: {
    event_type: string;
    scope_key: string | null;
    new_status: string;
    remark: string | null;
    created_at: string;
  }[];
  remarks: { scope_key: string; action_type: string; remark: string; created_at: string }[];
  applicationId?: string | null;
  /** Product id for resubmit comparison modal workflow tabs. */
  productKey?: string | null;
  /** Override section labels for timeline display (e.g. contract_details → "Customer" for invoice_only). */
  sectionLabelOverrides?: Record<string, string>;
  /** Same as application `visible_review_sections` — resubmit comparison tabs match main review. */
  visibleReviewSections?: unknown;
}

export function RecentActivityCard({
  reviewTabSections,
  events,
  remarks,
  applicationId,
  productKey,
  sectionLabelOverrides,
  visibleReviewSections,
}: RecentActivityCardProps) {
  const recentActivity = React.useMemo(() => {
    const combined: {
      type: string;
      key: string;
      status?: string;
      remark?: string;
      created_at: string;
    }[] = [];
    for (const e of events.slice(0, 10)) {
      combined.push({
        type: e.event_type,
        key: e.scope_key ?? "—",
        status: e.new_status,
        remark: e.remark ?? undefined,
        created_at: e.created_at,
      });
    }
    for (const n of remarks.slice(0, 5)) {
      combined.push({
        type: `REMARK:${n.action_type}`,
        key: n.scope_key,
        remark: n.remark,
        created_at: n.created_at,
      });
    }
    combined.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return combined.slice(0, 8);
  }, [events, remarks]);

  if (applicationId) {
    return (
      <AdminActivityTimeline
        applicationId={applicationId}
        productKey={productKey}
        reviewTabSections={reviewTabSections}
        sectionLabelOverrides={sectionLabelOverrides}
        visibleReviewSections={visibleReviewSections}
      />
    );
  }

  return (
    <Card className="rounded-2xl">
      {recentActivity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No review activity yet.</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {recentActivity.map((a, i) => (
            <div key={i} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
              <div className="font-medium">{a.type}</div>
              <div className="text-muted-foreground truncate" title={a.key}>
                {a.key}
              </div>
              {a.status && (
                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px]">
                  {a.status}
                </span>
              )}
              {a.remark && (() => {
                const lines = formatRemarkAsBullets(a.remark);
                if (lines.length === 0) return null;
                return (
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-muted-foreground">
                    {lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                );
              })()}
              <div className="mt-1 text-[10px] text-muted-foreground">
                {format(new Date(a.created_at), "dd MMM HH:mm")}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
