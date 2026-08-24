/** Issuer-selected financing tenure: 30–180 calendar days in 15-day steps. */

import {
  mytCalendarDayDiff,
  mytCalendarParts,
  type MytDateParts,
} from "./deadline-config";

export const FINANCING_TENURE_MIN_DAYS = 30;
export const FINANCING_TENURE_MAX_DAYS = 180;
export const FINANCING_TENURE_STEP_DAYS = 15;

function buildFinancingTenureDaysOptions(): readonly number[] {
  const options: number[] = [];
  for (
    let days = FINANCING_TENURE_MIN_DAYS;
    days <= FINANCING_TENURE_MAX_DAYS;
    days += FINANCING_TENURE_STEP_DAYS
  ) {
    options.push(days);
  }
  return options;
}

export const FINANCING_TENURE_DAYS_OPTIONS = buildFinancingTenureDaysOptions();

export function isValidFinancingTenureDays(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= FINANCING_TENURE_MIN_DAYS &&
    value <= FINANCING_TENURE_MAX_DAYS &&
    (value - FINANCING_TENURE_MIN_DAYS) % FINANCING_TENURE_STEP_DAYS === 0
  );
}

export function parseFinancingTenureDays(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isInteger(n)) return n;
  }
  return null;
}

export function formatFinancingTenureDaysLabel(days: number): string {
  return `${days} days`;
}

export function formatFinancingTenureFromDisbursement(days: number): string {
  return `${days} days from disbursement`;
}

/** Smallest published option that covers `minDays`. Null when even 180 is too short. */
export function smallestFinancingTenureDaysCovering(minDays: number): number | null {
  if (!Number.isFinite(minDays)) return null;
  const needed = Math.ceil(minDays);
  return FINANCING_TENURE_DAYS_OPTIONS.find((days) => days >= needed) ?? null;
}

export function parseMalaysiaCalendarDate(value: Date | string | null | undefined): MytDateParts | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return mytCalendarParts(value);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (!isValidCalendarYmd(year, month, day)) return null;
    return { year, month, day };
  }
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (!isValidCalendarYmd(year, month, day)) return null;
    return { year, month, day };
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return mytCalendarParts(parsed);
}

function isValidCalendarYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Malaysia calendar days from `from` to `dueDate` (due − from).
 * `yyyy-MM-dd` / `d/M/yyyy` are treated as calendar dates, not timezone instants.
 */
export function malaysiaCalendarDaysRemaining(
  from: Date | string,
  dueDate: Date | string
): number | null {
  const fromParts = parseMalaysiaCalendarDate(from);
  const dueParts = parseMalaysiaCalendarDate(dueDate);
  if (!fromParts || !dueParts) return null;
  return mytCalendarDayDiff(fromParts, dueParts);
}

export type FinancingTenureValidationResult =
  | { ok: true; tenureDays: number; daysRemaining: number }
  | { ok: false; message: string };

export function invoiceDetailsNeedFinancingTenureCheck(details: Record<string, unknown>): boolean {
  return (
    details.financing_tenure_days != null ||
    details.maturity_date != null ||
    details.due_date != null
  );
}

/**
 * Required integer on a published step, and tenure must cover Malaysia calendar
 * days remaining from the application/review date to the invoice due date.
 */
export function validateFinancingTenureAgainstDueDate(input: {
  tenureDays: unknown;
  maturityDate: unknown;
  referenceDate?: Date;
}): FinancingTenureValidationResult {
  const tenureDays = parseFinancingTenureDays(input.tenureDays);
  if (tenureDays == null) {
    return { ok: false, message: "Financing tenure is required." };
  }
  if (!isValidFinancingTenureDays(tenureDays)) {
    return {
      ok: false,
      message: `Financing tenure must be between ${FINANCING_TENURE_MIN_DAYS} and ${FINANCING_TENURE_MAX_DAYS} days in ${FINANCING_TENURE_STEP_DAYS}-day steps.`,
    };
  }

  const maturityRaw =
    typeof input.maturityDate === "string" || input.maturityDate instanceof Date
      ? input.maturityDate
      : null;
  const hasMaturity = Boolean(
    maturityRaw && (maturityRaw instanceof Date || String(maturityRaw).trim())
  );
  if (!hasMaturity || maturityRaw == null) {
    return { ok: false, message: "Invoice due date is required to validate financing tenure." };
  }

  const referenceDate = input.referenceDate ?? new Date();
  const daysRemaining = malaysiaCalendarDaysRemaining(referenceDate, maturityRaw);
  if (daysRemaining == null) {
    return { ok: false, message: "Invoice due date is invalid." };
  }
  if (daysRemaining < 0) {
    return { ok: false, message: "Invoice due date cannot be in the past." };
  }
  if (daysRemaining > FINANCING_TENURE_MAX_DAYS) {
    return {
      ok: false,
      message: `Financing tenure cannot cover this invoice because the due date is more than ${FINANCING_TENURE_MAX_DAYS} days away.`,
    };
  }
  if (tenureDays < daysRemaining) {
    return {
      ok: false,
      message: `Financing tenure must be at least ${daysRemaining} days to cover the time until the invoice due date.`,
    };
  }
  return { ok: true, tenureDays, daysRemaining };
}

export function resolveFinancingTenureDays(
  offerDetails?: unknown,
  invoiceDetails?: unknown
): number | null {
  const fromOffer = parseFinancingTenureDays(
    offerDetails && typeof offerDetails === "object"
      ? (offerDetails as { financing_tenure_days?: unknown }).financing_tenure_days
      : undefined
  );
  if (fromOffer != null && isValidFinancingTenureDays(fromOffer)) return fromOffer;
  const fromDetails = parseFinancingTenureDays(
    invoiceDetails && typeof invoiceDetails === "object"
      ? (invoiceDetails as { financing_tenure_days?: unknown }).financing_tenure_days
      : undefined
  );
  if (fromDetails != null && isValidFinancingTenureDays(fromDetails)) return fromDetails;
  return null;
}
