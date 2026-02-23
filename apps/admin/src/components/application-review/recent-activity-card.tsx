"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";

export interface RecentActivityCardProps {
  events: {
    event_type: string;
    scope_key: string | null;
    new_status: string;
    note: string | null;
    created_at: string;
  }[];
  notes: { scope_key: string; action_type: string; note: string; created_at: string }[];
}

export function RecentActivityCard({ events, notes }: RecentActivityCardProps) {
  const recentActivity = React.useMemo(() => {
    const combined: {
      type: string;
      key: string;
      status?: string;
      note?: string;
      created_at: string;
    }[] = [];
    for (const e of events.slice(0, 10)) {
      combined.push({
        type: e.event_type,
        key: e.scope_key ?? "—",
        status: e.new_status,
        note: e.note ?? undefined,
        created_at: e.created_at,
      });
    }
    for (const n of notes.slice(0, 5)) {
      combined.push({
        type: `NOTE:${n.action_type}`,
        key: n.scope_key,
        note: n.note,
        created_at: n.created_at,
      });
    }
    combined.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return combined.slice(0, 8);
  }, [events, notes]);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardDocumentCheckIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
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
                {a.note && (
                  <p className="mt-1 text-muted-foreground line-clamp-2">{a.note}</p>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {format(new Date(a.created_at), "dd MMM HH:mm")}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
