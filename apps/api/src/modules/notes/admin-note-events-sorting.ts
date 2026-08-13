export type AdminNoteEventsSortDirection = "newest-first" | "oldest-first";

type SortableAdminNoteEvent = {
  id: string;
  eventType: string;
  occurredAt?: string | Date;
  createdAt?: string | Date;
};

/**
 * Deterministic lifecycle ordering for admin note activity timelines.
 *
 * Primary order: `occurred_at` timestamp (newest-first).
 * Secondary order (only when timestamps tie): lifecycle priority.
 */
const ADMIN_NOTE_EVENT_LIFECYCLE_PRIORITY: Record<string, number> = Object.freeze(
  [
    "NOTE_CREATED",
    "NOTE_TERMS_UPDATED",
    "NOTE_PROSPECTUS_REVIEW_CREATED",
    "NOTE_PROSPECTUS_APPROVED",
    "NOTE_PROSPECTUS_INVALIDATED",
    "NOTE_PUBLISHED",
    "INVESTMENT_COMMITTED",
    "NOTE_FUNDING_CLOSED",
    "NOTE_FUNDING_FAILED",
    "DISBURSEMENT_INITIATED",
    "SHORAKA_ORDER_SUBMITTED",
    "SHORAKA_CERTIFICATE_RECEIVED",
    "DISBURSEMENT_LETTER_GENERATED",
    "DISBURSEMENT_SUBMITTED_TO_TRUSTEE",
    "DISBURSEMENT_BENEFICIARY_UPDATED",
    "DISBURSEMENT_COMPLETED",
    "NOTE_ACTIVATED",
    "REPAYMENT_SUBMITTED",
    "REPAYMENT_RECEIVED",
    "REPAYMENT_REJECTED",
    "SETTLEMENT_PREVIEWED",
    "SETTLEMENT_APPROVED",
    "SETTLEMENT_POSTED",
    "SERVICE_FEE_TRUSTEE_LETTER_GENERATED",
    "SERVICE_FEE_TRUSTEE_SUBMITTED",
    "SERVICE_FEE_TRUSTEE_COMPLETED",
    "RESIDUAL_RETURN_LETTER_GENERATED",
    "RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE",
    "RESIDUAL_RETURN_COMPLETED",
    "NOTE_SERVICING_STATUS_CHANGED",
    "ARREARS_LETTER_GENERATED",
    "DEFAULT_NOTICE_GENERATED",
    "NOTE_MARKED_DEFAULT",
    "NOTE_UNPUBLISHED",
    "TRUSTEE_SIGNATURE_UPDATED",
  ].reduce<Record<string, number>>((acc, eventType, index) => {
    acc[eventType] = index;
    return acc;
  }, {})
);

const UNKNOWN_EVENT_PRIORITY = 999;

function toEpochMs(value: string | Date | undefined): number {
  if (!value) return 0;
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
    const timeA = toEpochMs(a.occurredAt ?? a.createdAt);
    const timeB = toEpochMs(b.occurredAt ?? b.createdAt);

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

