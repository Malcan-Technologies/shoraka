import {
  compactAuditMetadata,
  formatAuditEventLabel,
  presentAuditActorName,
} from "./audit-presentation";

export const AUDIT_CSV_CORE_HEADERS = [
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

export type AuditCsvCoreHeader = (typeof AUDIT_CSV_CORE_HEADERS)[number];

export type AuditCsvRow = {
  timestamp: string;
  event: string;
  eventType: string;
  actor?: string | null;
  actorType?: string | null;
  actorEmail?: string | null;
  organisation?: string | null;
  source?: string | null;
  targetType?: string | null;
  targetReference?: string | null;
  status?: string | null;
  amount?: string | number | null;
  reason?: string | null;
  correlationId?: string | null;
  metadata?: unknown;
  extra?: Record<string, string | number | null | undefined>;
};

export function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [
    headers,
    ...rows.map((row) => row.map((cell) => (cell == null ? "" : String(cell)))),
  ];
  return lines.map((line) => line.map((cell) => csvCell(String(cell))).join(",")).join("\n");
}

export function buildAuditCsv(rows: AuditCsvRow[], extraHeaders: string[] = []): string {
  const extrasUsed = new Set<string>();
  for (const header of extraHeaders) extrasUsed.add(header);
  for (const row of rows) {
    for (const key of Object.keys(row.extra ?? {})) extrasUsed.add(key);
  }
  const extras = [...extrasUsed];
  const headers = [...AUDIT_CSV_CORE_HEADERS, ...extras];
  const csvRows = rows.map((row) => [
    row.timestamp,
    row.event || formatAuditEventLabel(row.eventType),
    row.eventType,
    presentAuditActorName(row.actor ?? null, row.actorType),
    row.actorType ?? "",
    row.actorEmail ?? "",
    row.organisation ?? "",
    row.source ?? "",
    row.targetType ?? "",
    row.targetReference ?? "",
    row.status ?? "",
    row.amount == null ? "" : String(row.amount),
    row.reason ?? "",
    row.correlationId ?? "",
    compactAuditMetadata(row.metadata),
    ...extras.map((header) => {
      const value = row.extra?.[header];
      return value == null ? "" : String(value);
    }),
  ]);
  return buildCsv(headers, csvRows);
}

export function downloadAuditCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
