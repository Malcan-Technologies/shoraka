import type { NoteAuditLogDto } from "@cashsouk/types";
import {
  formatAdminTimelineValue,
  type AdminTimelineDetail,
} from "@/components/admin-timeline-format";

const HIDDEN_METADATA_KEYS = new Set([
  "s3Key",
  "actorUserId",
  "actorName",
  "actor_name",
  "correlationId",
]);

const OVERDUE_CHECK_FIELDS = [
  { key: "dueDate", label: "Due date" },
  { key: "overdue", label: "Overdue" },
  { key: "daysLate", label: "Days late" },
  { key: "checkDate", label: "Checked" },
] as const;

const GENERIC_LIMIT = 6;
const PROSE_KEYS = new Set(["message", "reason", "description", "remark", "note"]);
const PROSE_VALUE_MIN_LENGTH = 48;

function formatMetadataLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function stringifyMetadataValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return formatAdminTimelineValue(String(value));
  }
  return null;
}

function isProseField(key: string, value: string) {
  if (PROSE_KEYS.has(key.toLowerCase())) return true;
  return value.length >= PROSE_VALUE_MIN_LENGTH;
}

function pushDetail(
  rows: AdminTimelineDetail[],
  key: string,
  label: string,
  raw: unknown
) {
  const value = stringifyMetadataValue(raw);
  if (!value) return;
  rows.push({ key, label, value });
}

export function extractNoteTimelineDetails(event: NoteAuditLogDto): {
  compact: AdminTimelineDetail[];
  prose: AdminTimelineDetail[];
} {
  const metadata = event.metadata ?? {};

  if (event.eventType === "OVERDUE_LATE_CHARGE_CHECKED") {
    const compact: AdminTimelineDetail[] = [];
    for (const field of OVERDUE_CHECK_FIELDS) {
      pushDetail(compact, field.key, field.label, metadata[field.key]);
    }
    const prose: AdminTimelineDetail[] = [];
    pushDetail(prose, "message", "Message", metadata.message);
    return { compact, prose };
  }

  const compact: AdminTimelineDetail[] = [];
  const prose: AdminTimelineDetail[] = [];

  for (const [key, raw] of Object.entries(metadata)) {
    if (HIDDEN_METADATA_KEYS.has(key)) continue;
    const value = stringifyMetadataValue(raw);
    if (!value) continue;
    const detail = { key, label: formatMetadataLabel(key), value };
    if (isProseField(key, value)) prose.push(detail);
    else compact.push(detail);
  }

  return { compact: compact.slice(0, GENERIC_LIMIT), prose };
}

export function noteDocumentFileName(s3Key: string) {
  const segment = s3Key.split("/").pop()?.trim();
  return segment || "Letter.pdf";
}
