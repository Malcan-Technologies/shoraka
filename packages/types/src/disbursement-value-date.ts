/** Ops-entered Malaysia disbursement calendar date stored as UTC midnight. */

import { mytCalendarParts } from "./deadline-config";
import { parseMalaysiaCalendarDate } from "./financing-tenure";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatCalendarYmd(parts: { year: number; month: number; day: number }): string {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function malaysiaTodayYmd(now: Date = new Date()): string {
  return formatCalendarYmd(mytCalendarParts(now));
}

/** `yyyy-MM-dd` → UTC midnight Date. Host timezone does not shift the calendar day. */
export function parseMalaysiaYmdToUtcMidnight(value: string): Date | null {
  const trimmed = value.trim();
  if (!YMD_RE.test(trimmed)) return null;
  const parts = parseMalaysiaCalendarDate(trimmed);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function addUtcCalendarDays(date: Date, days: number): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || !Number.isInteger(days)) {
    throw new Error("addUtcCalendarDays requires a valid Date and integer day count");
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export type DisbursementValueDateValidation =
  | { ok: true; date: Date; ymd: string }
  | { ok: false; message: string };

export function validateDisbursementValueDate(
  value: unknown,
  now: Date = new Date()
): DisbursementValueDateValidation {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return { ok: false, message: "Actual disbursement date is required." };
  }
  if (typeof value !== "string") {
    return { ok: false, message: "Actual disbursement date is invalid." };
  }
  const trimmed = value.trim();
  if (!YMD_RE.test(trimmed)) {
    return {
      ok: false,
      message: "Actual disbursement date must be a calendar date (yyyy-MM-dd).",
    };
  }
  const date = parseMalaysiaYmdToUtcMidnight(trimmed);
  if (!date) {
    return { ok: false, message: "Actual disbursement date is not a valid calendar date." };
  }
  if (trimmed > malaysiaTodayYmd(now)) {
    return { ok: false, message: "Actual disbursement date cannot be in the future." };
  }
  return { ok: true, date, ymd: trimmed };
}

export function isTenureBackedNote(tenureDays: number | null | undefined): boolean {
  return typeof tenureDays === "number" && Number.isInteger(tenureDays) && tenureDays > 0;
}
