/**
 * Civil dates (DOB, incorporation, appointment) are Malaysia calendar days,
 * not UTC instants. Persist as UTC midnight of that YYYY-MM-DD so the ISO
 * prefix matches the civil day. Older rows may be local-midnight MYT; those
 * are read in Asia/Kuala_Lumpur. Never format these with
 * `new Date(value).toLocaleDateString()` — that shifts a day in western TZs.
 */

import { PHASE_DEADLINE_TZ, mytCalendarParts } from "./deadline-config";

export const CASHSOUK_TIMEZONE = PHASE_DEADLINE_TZ;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const ISO_DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DMY_DATE_RE = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;

export function isValidCalendarDateKey(key: string): boolean {
  const match = ISO_DATE_ONLY_RE.exec(key.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function civilDateFromParts(year: string, month: string, day: string): string | null {
  const key = `${year}-${month}-${day}`;
  return isValidCalendarDateKey(key) ? key : null;
}

function malaysiaCivilDate(instant: Date): string | null {
  const parts = mytCalendarParts(instant);
  return civilDateFromParts(
    String(parts.year),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0")
  );
}

/**
 * YYYY-MM-DD in Asia/Kuala_Lumpur. Date-only strings keep their civil day.
 * Timestamps (including Prisma DateTime) use Malaysia, so MYT midnight stored
 * as the previous UTC evening still maps to the intended calendar date.
 */
export function calendarDateKey(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return malaysiaCivilDate(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnly = ISO_DATE_ONLY_RE.exec(trimmed);
  if (dateOnly) return civilDateFromParts(dateOnly[1]!, dateOnly[2]!, dateOnly[3]!);

  const dmy = DMY_DATE_RE.exec(trimmed);
  if (dmy) return civilDateFromParts(dmy[3]!, dmy[2]!, dmy[1]!);

  if (!ISO_DATE_PREFIX_RE.test(trimmed)) return null;
  const instant = new Date(trimmed);
  if (Number.isNaN(instant.getTime())) return null;
  return malaysiaCivilDate(instant);
}

/** UTC midnight of the Malaysia civil day — safe to persist on DateTime columns. */
export function parseCalendarDate(value: unknown): Date | null {
  const key = calendarDateKey(value);
  if (!key) return null;
  const parsed = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Value for `<input type="date" />`. */
export function toCalendarDateInput(value: unknown): string {
  return calendarDateKey(value) ?? "";
}

/** Display like `14 Nov 1989`. Empty string when missing/invalid. */
export function formatCalendarDate(value: unknown): string {
  const key = calendarDateKey(value);
  if (!key) return "";
  const [year, month, day] = key.split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !monthName || !day) return key;
  return `${Number(day)} ${monthName} ${year}`;
}
