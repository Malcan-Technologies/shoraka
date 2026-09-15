import type { NoteEvent } from "@cashsouk/types";
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
    .trim()
    .replace(/\bId\b/g, "ID");
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

export function extractNoteTimelineDetails(
  event: NoteEvent,
  noteTitle?: string | null
): {
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

  if (event.eventType === "ACTIVATE") {
    const actor = event.actorName?.trim() || "An admin";
    const noteLabel = noteTitle?.trim() ? ` ${noteTitle.trim()}` : " the note";
    return {
      compact: [],
      prose: [
        {
          key: "message",
          label: "Message",
          value: `${actor} activated${noteLabel}. Servicing has started.`,
        },
      ],
    };
  }

  const compact: AdminTimelineDetail[] = [];
  const prose: AdminTimelineDetail[] = [];

  for (const [key, raw] of Object.entries(metadata)) {
    if (HIDDEN_METADATA_KEYS.has(key)) continue;
    if (key === "resend") {
      if (raw === true) compact.push({ key, label: "Redelivery", value: "Redelivered" });
      continue;
    }

    const prefixForIdKey = key.endsWith("Id") ? key.slice(0, -2) : null;
    if (prefixForIdKey && typeof raw === "string") {
      const canonicalValue = (() => {
        const v1 = (metadata as Record<string, unknown>)[`${prefixForIdKey}Reference`];
        if (typeof v1 === "string" && v1.trim().length > 0) return v1.trim();
        const v2 = (metadata as Record<string, unknown>)[`${prefixForIdKey}_reference`];
        if (typeof v2 === "string" && v2.trim().length > 0) return v2.trim();
        const v3 = (metadata as Record<string, unknown>)[`${prefixForIdKey}DisplayReference`];
        if (typeof v3 === "string" && v3.trim().length > 0) return v3.trim();
        return null;
      })();

      if (canonicalValue) {
        const entityName =
          prefixForIdKey.length > 0
            ? `${prefixForIdKey[0].toUpperCase()}${prefixForIdKey.slice(1)}`
            : prefixForIdKey;
        compact.push({
          key,
          label: `${entityName} ID`,
          value: canonicalValue,
        });
        continue;
      }
    }

    // Suppress canonical reference keys when the corresponding internal `<entity>Id` exists
    // (because we render both in the internal-id branch above).
    if (
      (key.endsWith("Reference") || key.endsWith("_reference") || key.endsWith("DisplayReference")) &&
      typeof raw === "string"
    ) {
      const internalKeyGuess = (() => {
        if (key.endsWith("Reference")) return `${key.slice(0, -("Reference".length))}Id`;
        if (key.endsWith("_reference")) return `${key.slice(0, -("_reference".length))}Id`;
        if (key.endsWith("DisplayReference"))
          return `${key.slice(0, -("DisplayReference".length))}Id`;
        return "";
      })();
      const hasInternal = (metadata as Record<string, unknown>)[internalKeyGuess];
      if (typeof hasInternal === "string" && hasInternal.trim().length > 0) continue;
    }

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
