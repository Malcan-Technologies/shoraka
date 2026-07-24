/**
 * Shared UTC calendar-day helpers for prospectus-aligned admin verification.
 * Matches Page 1 prospectus date/tenure maths (apps/api calculators + formatProspectusDateUtc).
 */

const DAY_MS = 1000 * 60 * 60 * 24;

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function utcStartOfDayMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** UTC start-of-day difference; same behaviour as API calculateCalendarDayCount. */
export function calculateCalendarDayCount(startDate: Date, endDate: Date): number {
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return 0;
  return Math.max(0, Math.floor((utcStartOfDayMs(endDate) - utcStartOfDayMs(startDate)) / DAY_MS));
}

/**
 * Date-only display in en-MY style using UTC calendar parts.
 * Same behaviour as prospectus formatProspectusDateUtc (e.g. "15 May 2025").
 */
export function formatUtcCalendarDateEnMy(
  value: Date | string | null | undefined
): string | null {
  const date = toValidDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
