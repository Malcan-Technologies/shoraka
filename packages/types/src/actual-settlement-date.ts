/** Ops-confirmed Malaysia bank value date for tenure-note settlement, stored as UTC midnight. */

import {
  formatCalendarYmd,
  malaysiaTodayYmd,
  parseMalaysiaYmdToUtcMidnight,
} from "./disbursement-value-date";
import { parseMalaysiaCalendarDate } from "./financing-tenure";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function malaysiaCalendarYmdFromInstant(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    if (
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    ) {
      return formatCalendarYmd({
        year: value.getUTCFullYear(),
        month: value.getUTCMonth() + 1,
        day: value.getUTCDate(),
      });
    }
  }
  const parts = parseMalaysiaCalendarDate(value);
  return parts ? formatCalendarYmd(parts) : null;
}

export type ActualSettlementDateValidation =
  | { ok: true; date: Date; ymd: string }
  | { ok: false; message: string };

export function validateActualSettlementDate(
  value: unknown,
  options: {
    now?: Date;
    disbursementDate?: Date | string | null;
    latestIncludedReceiptDate?: Date | string | null;
    required?: boolean;
    label?: string;
  } = {}
): ActualSettlementDateValidation {
  const label = options.label ?? "Actual settlement date";
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    if (options.required === false) {
      return { ok: false, message: `${label} is required.` };
    }
    return { ok: false, message: `${label} is required.` };
  }
  if (typeof value !== "string") {
    return { ok: false, message: `${label} is invalid.` };
  }
  const trimmed = value.trim();
  if (!YMD_RE.test(trimmed)) {
    return { ok: false, message: `${label} must be a calendar date (yyyy-MM-dd).` };
  }
  const date = parseMalaysiaYmdToUtcMidnight(trimmed);
  if (!date) {
    return { ok: false, message: `${label} is not a valid calendar date.` };
  }
  const now = options.now ?? new Date();
  if (trimmed > malaysiaTodayYmd(now)) {
    return { ok: false, message: `${label} cannot be in the future.` };
  }
  const disbursementYmd = malaysiaCalendarYmdFromInstant(options.disbursementDate ?? null);
  if (disbursementYmd && trimmed < disbursementYmd) {
    return { ok: false, message: `${label} cannot be before the disbursement date.` };
  }
  const latestReceiptYmd = malaysiaCalendarYmdFromInstant(options.latestIncludedReceiptDate ?? null);
  if (latestReceiptYmd && trimmed < latestReceiptYmd) {
    return {
      ok: false,
      message: `${label} cannot be earlier than the latest included receipt.`,
    };
  }
  return { ok: true, date, ymd: trimmed };
}

export function resolveDefaultActualSettlementYmd(
  latestIncludedReceiptDate?: Date | string | null,
  now: Date = new Date()
): string {
  const today = malaysiaTodayYmd(now);
  const latestReceiptYmd = malaysiaCalendarYmdFromInstant(latestIncludedReceiptDate ?? null);
  if (!latestReceiptYmd) return today;
  return latestReceiptYmd > today ? today : latestReceiptYmd;
}

export const defaultActualSettlementYmd = resolveDefaultActualSettlementYmd;
