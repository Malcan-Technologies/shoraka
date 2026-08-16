"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type AuditLogDetail = {
  id: string;
  eventType: string;
  eventLabel?: string;
  occurredAt: string;
  createdAt?: string | null;
  actorType?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorUserId?: string | null;
  subjectUserId?: string | null;
  organizationId?: string | null;
  organizationKind?: string | null;
  organizationType?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  source?: string | null;
  portal?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  correlationId?: string | null;
  extraFields?: Array<{ label: string; value: string | null | undefined }>;
  metadata: Record<string, unknown>;
};

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

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-all text-sm">{value ?? "—"}</p>
    </div>
  );
}

export function AuditLogDetailSheet({
  log,
  open,
  onOpenChange,
  title = "Audit event",
  description = "Read-only audit record.",
}: {
  log: AuditLogDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {log ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Audit ID" value={log.id} />
              <DetailField label="Event" value={log.eventLabel ?? log.eventType} />
              <DetailField label="Occurred at" value={formatTimestamp(log.occurredAt)} />
              {log.createdAt ? (
                <DetailField label="Created at" value={formatTimestamp(log.createdAt)} />
              ) : null}
              <DetailField label="Actor" value={log.actorName} />
              <DetailField label="Actor email" value={log.actorEmail} />
              <DetailField label="Actor type" value={log.actorType} />
              <DetailField label="Actor user ID" value={log.actorUserId} />
              {log.subjectUserId ? (
                <DetailField label="Subject user ID" value={log.subjectUserId} />
              ) : null}
              {log.organizationId ? (
                <DetailField label="Organization ID" value={log.organizationId} />
              ) : null}
              {log.organizationKind ? (
                <DetailField label="Organization kind" value={log.organizationKind} />
              ) : null}
              {log.organizationType ? (
                <DetailField label="Organization type" value={log.organizationType} />
              ) : null}
              {log.targetType || log.targetId ? (
                <DetailField
                  label="Target"
                  value={[log.targetType, log.targetId].filter(Boolean).join(" · ") || "—"}
                />
              ) : null}
              <DetailField label="Source" value={log.source} />
              <DetailField label="Portal" value={log.portal} />
              <DetailField label="IP address" value={log.ipAddress} />
              <DetailField label="Device" value={log.deviceInfo} />
              <DetailField label="User agent" value={log.userAgent} />
              <DetailField label="Correlation ID" value={log.correlationId} />
              {(log.extraFields ?? []).map((field) => (
                <DetailField key={field.label} label={field.label} value={field.value} />
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Metadata</p>
              <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
