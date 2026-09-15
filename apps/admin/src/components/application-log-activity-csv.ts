import type { ApplicationLogEntry } from "@/hooks/use-application-logs";
import type { AdminActivityCsvRow } from "@/components/admin-activity-csv";
import { mergeActivityCsvMetadata } from "@/components/admin-activity-csv";

function formatActivityText(activity: ApplicationLogEntry["activity"]): string | null {
  if (activity == null) return null;
  if (typeof activity === "string") return activity;
  if (typeof activity === "number" || typeof activity === "boolean") return String(activity);
  return JSON.stringify(activity);
}

function readString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Export-only presentation for application-scoped audit rows.
 *
 * Never rewrites internal DB identifiers in persisted data; this only affects the CSV mapper.
 */
export function applicationLogToActivityCsvRow(
  log: ApplicationLogEntry,
  eventLabel: string
): AdminActivityCsvRow {
  const metadata = log.metadata;
  const actorRaw = metadata?.actorName ?? metadata?.organizationName;
  const actor =
    typeof actorRaw === "string" && actorRaw.trim() !== "" ? actorRaw : "";
  const portalRaw = metadata?.portal ?? metadata?.portalType;

  const internalTargetId = log.target_id ?? log.entityId ?? null;
  const targetType = log.target_type ?? null;

  // Canonical target reference for export: prefer B-display references snapshot into metadata.
  const canonicalTargetReference =
    targetType === "CONTRACT"
      ? readString(metadata?.contractReference)
      : targetType === "INVOICE"
        ? readString(metadata?.invoiceReference)
        : // Default to applicationReference for application/application section/item events.
          readString(metadata?.applicationReference) ?? readString(metadata?.application_reference);

  const targetReference = canonicalTargetReference ?? internalTargetId ?? log.entityId ?? null;

  return {
    createdAt: log.created_at,
    event: eventLabel,
    eventType: log.event_type,
    actor,
    actorUserId: log.actor_id ?? "",
    portal: typeof portalRaw === "string" ? portalRaw : "",
    remark: log.remark ?? formatActivityText(log.activity) ?? "",
    metadata: mergeActivityCsvMetadata(metadata, {
      entityId: log.entityId,
      review_cycle: log.review_cycle,
      ip_address: log.ip_address,
    }),
    actorType: log.actor_type,
    source: log.source ?? (typeof portalRaw === "string" ? portalRaw : null),
    targetType,
    targetReference,
    extra: internalTargetId != null ? { "Target Internal ID": internalTargetId } : undefined,
    correlationId: log.correlation_id,
  };
}

