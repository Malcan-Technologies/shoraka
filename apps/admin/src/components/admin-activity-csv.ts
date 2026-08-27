import {
  buildAuditCsv,
  type AuditCsvRow,
} from "@/components/audit/audit-csv";
import {
  formatAuditEventLabel,
  presentAuditActorName,
} from "@/components/audit/audit-presentation";

export type AdminActivityCsvRow = {
  createdAt: string;
  event: string;
  eventType: string;
  actor: string;
  actorUserId: string;
  portal: string;
  remark: string;
  metadata: Record<string, unknown> | null;
  actorType?: string | null;
  actorEmail?: string | null;
  organisation?: string | null;
  source?: string | null;
  targetType?: string | null;
  targetReference?: string | null;
  status?: string | null;
  amount?: string | number | null;
  correlationId?: string | null;
  extra?: Record<string, string | number | null | undefined>;
};

export const ADMIN_ACTIVITY_CSV_HEADERS = [
  "Timestamp",
  "Event",
  "Event Type",
  "Actor",
  "Actor Type",
  "Actor Email",
  "Organisation",
  "Source",
  "Target Type",
  "Target Reference",
  "Status",
  "Amount",
  "Reason",
  "Correlation ID",
  "Metadata",
] as const;

export function mergeActivityCsvMetadata(
  base: Record<string, unknown> | null | undefined,
  extra: Record<string, unknown>
): Record<string, unknown> | null {
  const extras = Object.fromEntries(
    Object.entries(extra).filter(([, value]) => value != null && value !== "")
  );
  if (!base && Object.keys(extras).length === 0) return null;
  return { ...(base ?? {}), ...extras };
}

export function buildAdminActivityCsv(rows: AdminActivityCsvRow[]): string {
  const mapped: AuditCsvRow[] = rows.map((row) => ({
    timestamp: row.createdAt,
    event: row.event || formatAuditEventLabel(row.eventType),
    eventType: row.eventType,
    actor: presentAuditActorName(row.actor, row.actorType),
    actorType: row.actorType ?? "",
    actorEmail: row.actorEmail ?? "",
    organisation: row.organisation ?? "",
    source: row.source ?? row.portal ?? "",
    targetType: row.targetType ?? "",
    targetReference: row.targetReference ?? "",
    status: row.status ?? "",
    amount: row.amount ?? "",
    reason: row.remark ?? "",
    correlationId: row.correlationId ?? "",
    metadata: mergeActivityCsvMetadata(row.metadata, {
      actorUserId: row.actorUserId || null,
    }),
    extra: row.extra,
  }));
  return buildAuditCsv(mapped);
}

export function downloadAdminActivityCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
