"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AuditLogDetailSheet,
  type AuditLogDetail,
} from "@/components/audit/audit-log-detail-sheet";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actorLabel(row: AuditLogDetail): string {
  return row.actorName || row.actorEmail || row.actorUserId || row.actorType || "—";
}

function targetLabel(row: AuditLogDetail): string {
  return [row.targetType, row.targetId].filter(Boolean).join(" · ") || "—";
}

function sourcePortalLabel(row: AuditLogDetail): string {
  return [row.source, row.portal].filter(Boolean).join(" / ") || "—";
}

export function ContextualAuditHistoryPanel({
  title = "Audit History",
  description = "Raw forensic audit records. Not the curated Activity feed.",
  rows,
  isLoading = false,
  error = null,
  emptyMessage = "No audit records found",
  variant = "card",
}: {
  title?: string;
  description?: string;
  rows: AuditLogDetail[];
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  variant?: "card" | "plain";
}) {
  const [selected, setSelected] = React.useState<AuditLogDetail | null>(null);

  const body = (
    <>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">
          {error.message || "Failed to load audit history."}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Source / Portal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatTimestamp(row.occurredAt)}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {row.eventLabel ?? row.eventType}
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate text-xs">
                    {actorLabel(row)}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate font-mono text-xs">
                    {targetLabel(row)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {sourcePortalLabel(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AuditLogDetailSheet
        log={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Audit event"
        description="Read-only forensic audit record."
      />
    </>
  );

  if (variant === "plain") {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
