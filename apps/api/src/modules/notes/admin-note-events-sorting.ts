export type AdminNoteEventsSortDirection = "newest-first" | "oldest-first";

type SortableAdminNoteEvent = {
  id: string;
  eventType: string;
  createdAt: string | Date;
};

/**
 * Deterministic lifecycle ordering for admin note activity timelines.
 *
 * Primary order: `created_at` timestamp (newest-first).
 * Secondary order (only when timestamps tie): lifecycle priority.
 */
const ADMIN_NOTE_EVENT_LIFECYCLE_PRIORITY: Record<string, number> = Object.freeze(
  [
    // Earliest -> Latest (priority increases)
    "NOTE_CREATED_FROM_INVOICE",
    "PUBLISH",
    "INVESTMENT_COMMITTED",
    "CLOSE_FUNDING",
    "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED",
    "WITHDRAWAL_LETTER_GENERATED",
    "WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
    "WITHDRAWAL_COMPLETED",
    "PAYMENT_RECEIVED",
    "ISSUER_PAYMENT_SUBMITTED",
    "SETTLEMENT_PREVIEWED",
    "SETTLEMENT_APPROVED",
    // Service fee trustee flow (actual event types in the backend end with LETTER_* and *_INSTRUCTION_COMPLETED)
    "SERVICE_FEE_TRUSTEE_LETTER_GENERATED",
    "SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED",
    "SERVICE_FEE_TRUSTEE_INSTRUCTION_COMPLETED",
    // Residual / refund withdrawal creation (actual backend event type)
    "ISSUER_RESIDUAL_WITHDRAWAL_CREATED",
    // Residual/refund letters reuse the normal WITHDRAWAL_* events above.
    "ARREARS_LETTER_GENERATED",
    "DEFAULT_LETTER_GENERATED",
    "NOTE_DEFAULT_MARKED",
  ].reduce<Record<string, number>>((acc, eventType, index) => {
    acc[eventType] = index;
    return acc;
  }, {})
);

const UNKNOWN_EVENT_PRIORITY = 999;

function toEpochMs(value: string | Date): number {
  if (value instanceof Date) return value.getTime();
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function sortAdminNoteEvents<T extends SortableAdminNoteEvent>(
  events: T[],
  direction: AdminNoteEventsSortDirection
): T[] {
  const dir = direction === "newest-first" ? -1 : 1; // -1 => newest-first
  return [...events].sort((a, b) => {
    const timeA = toEpochMs(a.createdAt);
    const timeB = toEpochMs(b.createdAt);

    if (timeA !== timeB) {
      // For newest-first, larger epoch should sort first.
      return (timeA - timeB) * dir;
    }

    const priorityA = ADMIN_NOTE_EVENT_LIFECYCLE_PRIORITY[a.eventType] ?? UNKNOWN_EVENT_PRIORITY;
    const priorityB = ADMIN_NOTE_EVENT_LIFECYCLE_PRIORITY[b.eventType] ?? UNKNOWN_EVENT_PRIORITY;

    if (priorityA !== priorityB) {
      // For newest-first, higher priority number should sort first.
      return (priorityA - priorityB) * dir;
    }

    // Final deterministic tie-breaker.
    return a.id.localeCompare(b.id);
  });
}

