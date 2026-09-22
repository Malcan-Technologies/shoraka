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

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Parse `<input type="datetime-local" />` as Asia/Kuala_Lumpur wall time (no DST).
 * Accepts `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`.
 */
export function parseMalaysiaDateTimeLocal(value: string): Date | null {
  const match = DATETIME_LOCAL_RE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] != null ? Number(match[6]) : 0;
  if (!isValidCalendarDateKey(`${year}-${pad2(month)}-${pad2(day)}`)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second, 0));
}

/** ISO UTC instant for a Malaysia datetime-local string. */
export function malaysiaDateTimeLocalToIso(value: string): string | null {
  return parseMalaysiaDateTimeLocal(value)?.toISOString() ?? null;
}

/** Value for `<input type="datetime-local" />` in Asia/Kuala_Lumpur. */
export function toMalaysiaDateTimeLocalInput(value: unknown): string {
  const instant =
    value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!instant || Number.isNaN(instant.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CASHSOUK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  if (!year || !month || !day || !hour || !minute) return "";
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
