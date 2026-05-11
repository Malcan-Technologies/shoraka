import type { Prisma } from "@prisma/client";

type ParsedWebhookPayload = {
  statusUpper: string;
  timestampMillis: number | null;
  originalIndex: number;
};

function isPlainObjectRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parsePayloadItemToStatusAndTimestamp(
  item: unknown,
  originalIndex: number
): ParsedWebhookPayload | null {
  let obj: Record<string, unknown> | null = null;

  if (isPlainObjectRecord(item)) {
    obj = item;
  } else if (typeof item === "string") {
    try {
      const parsed = JSON.parse(item) as unknown;
      if (isPlainObjectRecord(parsed)) obj = parsed;
    } catch {
      // Ignore invalid JSON strings safely
      return null;
    }
  }

  if (!obj) return null;

  const rawStatus = obj.status;
  if (typeof rawStatus !== "string") return null;

  const statusUpper = rawStatus.toUpperCase();

  // RegTank webhook payloads typically include `timestamp` as an ISO string.
  // Keep it flexible: accept ISO string or number, ignore invalid values.
  const rawTimestamp = obj.timestamp;
  let timestampMillis: number | null = null;
  if (typeof rawTimestamp === "string") {
    const ms = new Date(rawTimestamp).getTime();
    timestampMillis = Number.isNaN(ms) ? null : ms;
  } else if (typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)) {
    timestampMillis = rawTimestamp;
  } else {
    timestampMillis = null;
  }

  return { statusUpper, timestampMillis, originalIndex };
}

/**
 * Detect whether RegTank is currently in "amendment in progress" mode.
 *
 * Rule (derived, transient sub-state):
 * - Amendment is active only when the latest meaningful status is `URL_GENERATED`
 *   and there has been at least one `WAIT_FOR_APPROVAL` earlier.
 *
 * Meaningful statuses:
 * - `WAIT_FOR_APPROVAL`
 * - `URL_GENERATED`
 *
 * Examples:
 * - URL_GENERATED -> WAIT_FOR_APPROVAL  => false
 * - URL_GENERATED -> WAIT_FOR_APPROVAL -> URL_GENERATED => true
 * - URL_GENERATED -> WAIT_FOR_APPROVAL -> URL_GENERATED -> WAIT_FOR_APPROVAL => false
 */
export function isRegtankAmendmentInProgress(
  webhookPayloads: Prisma.JsonValue[] | unknown
): boolean {
  if (!Array.isArray(webhookPayloads)) return false;

  const parsed = webhookPayloads
    .map((item, idx) => parsePayloadItemToStatusAndTimestamp(item, idx))
    .filter((x): x is ParsedWebhookPayload => Boolean(x));

  if (parsed.length === 0) return false;

  const meaningfulStatuses = new Set(["WAIT_FOR_APPROVAL", "URL_GENERATED"]);
  const meaningful = parsed.filter((p) => meaningfulStatuses.has(p.statusUpper));
  if (meaningful.length === 0) return false;

  const shouldSort = meaningful.every((e) => e.timestampMillis !== null);
  const meaningfulOrdered = shouldSort
    ? [...meaningful].sort((a, b) => {
        const diff = (a.timestampMillis as number) - (b.timestampMillis as number);
        if (diff !== 0) return diff;
        return a.originalIndex - b.originalIndex;
      })
    : meaningful;

  const latestMeaningful = meaningfulOrdered[meaningfulOrdered.length - 1]!;
  if (latestMeaningful.statusUpper !== "URL_GENERATED") return false;

  // Amendment is only considered "in progress" if we've seen a previous WAIT_FOR_APPROVAL.
  // This prevents "URL_GENERATED only" from matching.
  for (let i = 0; i < meaningfulOrdered.length - 1; i++) {
    if (meaningfulOrdered[i].statusUpper === "WAIT_FOR_APPROVAL") return true;
  }

  return false;
}

