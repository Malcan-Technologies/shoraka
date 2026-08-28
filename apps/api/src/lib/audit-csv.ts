import { formatForensicAuditSourceLabel, formatRoleSwitchedLabel } from "@cashsouk/types";

export { formatRoleSwitchedLabel };

const ACRONYMS = new Set(["AML", "KYC", "KYB", "TNC", "SSM", "PDF", "CSV", "API", "ID", "MARC"]);

const SECRET_KEY =
  /^(.*[_-]?)?(password|secret|access_?token|refresh_?token|id_token|private_?key|api_?key|authorization|credential|session_token)([_-].*)?$/i;

export function humanizeAuditEventType(eventType: string, overrides?: Record<string, string>): string {
  const trimmed = eventType.trim();
  if (!trimmed) return "";
  if (overrides?.[trimmed]) return overrides[trimmed];
  if (!/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(trimmed)) return trimmed;
  if (ACRONYMS.has(trimmed)) return trimmed;
  return trimmed
    .split("_")
    .map((word) => (ACRONYMS.has(word) ? word : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(" ");
}

export function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map((line) => line.map((cell) => csvCell(cell)).join(","))
    .join("\n");
}

export function redactAuditSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? "[REDACTED]" : redactAuditSecrets(nested);
    }
    return out;
  }
  return value;
}

export function serializeAuditMetadata(value: unknown): string {
  if (value == null) return "";
  try {
    return JSON.stringify(redactAuditSecrets(value));
  } catch {
    return String(value);
  }
}

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

export type AuditCsvCoreRow = {
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

function systemActorName(name: string | null | undefined, actorType?: string | null): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed || /^(sys|system|system job)$/i.test(trimmed)) return "System";
  if (actorType?.toUpperCase() === "SYSTEM" && !trimmed) return "System";
  return trimmed;
}

export function buildAuditCsv(rows: AuditCsvCoreRow[], extraHeaders: string[] = []): string {
  const extrasUsed = new Set(extraHeaders);
  for (const row of rows) {
    for (const key of Object.keys(row.extra ?? {})) extrasUsed.add(key);
  }
  const extras = [...extrasUsed];
  const headers = [...AUDIT_CSV_CORE_HEADERS, ...extras];
  const csvRows = rows.map((row) => [
    row.timestamp,
    row.event,
    row.eventType,
    systemActorName(row.actor, row.actorType),
    row.actorType ?? "",
    row.actorEmail ?? "",
    row.organisation ?? "",
    formatForensicAuditSourceLabel(row.source),
    row.targetType ?? "",
    row.targetReference ?? "",
    row.status ?? "",
    row.amount == null ? "" : String(row.amount),
    row.reason ?? "",
    row.correlationId ?? "",
    serializeAuditMetadata(row.metadata),
    ...extras.map((header) => {
      const value = row.extra?.[header];
      return value == null ? "" : String(value);
    }),
  ]);
  return buildCsv(headers, csvRows);
}
