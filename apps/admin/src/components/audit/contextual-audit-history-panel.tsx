"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AuditLogDetailFields,
  AuditLogDetailSheet,
  type AuditLogDetail,
} from "@/components/audit/audit-log-detail-sheet";
import { formatAuditDateTime } from "@/lib/audit-datetime";
import { ChevronLeftIcon, ChevronRightIcon, EyeIcon } from "@heroicons/react/24/outline";

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
  detailMode = "sheet",
  page,
  pageSize,
  totalCount,
  onPageChange,
}: {
  title?: string;
  description?: string;
  rows: AuditLogDetail[];
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  variant?: "card" | "plain";
  detailMode?: "sheet" | "inline";
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
}) {
  const [selected, setSelected] = React.useState<AuditLogDetail | null>(null);
  const totalPages =
    page && pageSize && typeof totalCount === "number"
      ? Math.max(1, Math.ceil(totalCount / pageSize))
      : undefined;

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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatAuditDateTime(row.occurredAt)}
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
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => setSelected(row)}
                    >
                      <EyeIcon className="mr-1 h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages && page && onPageChange && typeof totalCount === "number" && totalCount > 0 ? (
        <div className="flex items-center justify-between border-t px-1 py-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {detailMode === "inline" && selected ? (
        <div className="mt-6 space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Audit event</h4>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <AuditLogDetailFields log={selected} />
        </div>
      ) : (
        <AuditLogDetailSheet
          log={selected}
          open={selected !== null}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title="Audit event"
          description="Read-only forensic audit record."
        />
      )}
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
