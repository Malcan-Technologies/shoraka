/**
 * Configurable phase deadlines (acceptance / signing clocks) on financing-type workflow config.
 * Runtime stamps use Malaysia calendar days with an exclusive next-midnight MYT boundary.
 */

export type DeadlineReminderConfig = {
  /** Days before the displayed deadline date when a reminder should fire (0 = on deadline day). */
  days_before_expiry: number;
};

export type PhaseDeadlineConfig = {
  days: number;
  reminders: DeadlineReminderConfig[];
};

export const ACCEPTANCE_DEADLINE_WORKFLOW_KEY = "acceptance_deadline";
export const SIGNING_DEADLINE_WORKFLOW_KEY = "signing_deadline";

/** Malaysia timezone for offer phase deadlines (no DST). */
export const PHASE_DEADLINE_TZ = "Asia/Kuala_Lumpur";

/** Default platform reminder delivery hour (09:00 MYT). */
export const DEFAULT_OFFER_DEADLINE_REMINDER_HOUR = 9;

export const DEFAULT_ACCEPTANCE_DEADLINE: PhaseDeadlineConfig = {
  days: 7,
  reminders: [{ days_before_expiry: 1 }],
};

export const DEFAULT_SIGNING_DEADLINE: PhaseDeadlineConfig = {
  days: 14,
  reminders: [{ days_before_expiry: 3 }, { days_before_expiry: 1 }],
};

export type MytDateParts = { year: number; month: number; day: number };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseOptionalPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 0) return n;
  }
  return null;
}

/** Calendar date parts in Asia/Kuala_Lumpur. */
export function mytCalendarParts(date: Date): MytDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PHASE_DEADLINE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

/** UTC instant for 00:00 on the given MYT calendar date. */
export function mytStartOfDayUtc(parts: MytDateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, -8, 0, 0, 0));
}

/** UTC instant for HH:00 on the given MYT calendar date. */
export function mytHourOnDayUtc(parts: MytDateParts, hour: number): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 8, 0, 0, 0));
}

export function addMytCalendarDays(parts: MytDateParts, days: number): MytDateParts {
  const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return {
    year: anchor.getUTCFullYear(),
    month: anchor.getUTCMonth() + 1,
    day: anchor.getUTCDate(),
  };
}

/** Days between two MYT calendar dates (b - a). */
export function mytCalendarDayDiff(from: MytDateParts, to: MytDateParts): number {
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

/**
 * Exclusive expiry instant: N Malaysia calendar days after the stamp date, valid through
 * end of the resulting deadline date (displayed as 11:59 PM on that date).
 */
export function computePhaseDeadlineExpiresAt(fromIso: string | Date, days: number): string {
  const from = typeof fromIso === "string" ? new Date(fromIso) : fromIso;
  const stampDay = mytCalendarParts(from);
  const lastValidDay = addMytCalendarDays(stampDay, days);
  const exclusiveDay = addMytCalendarDays(lastValidDay, 1);
  return mytStartOfDayUtc(exclusiveDay).toISOString();
}

/** Last valid MYT calendar day before the exclusive midnight boundary. */
export function mytLastValidDayFromExpiresAt(expiresAtIso: string): MytDateParts {
  const exclusiveDay = mytCalendarParts(new Date(expiresAtIso));
  return addMytCalendarDays(exclusiveDay, -1);
}

export function isPhaseDeadlineExpired(expiresAtIso: string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(expiresAtIso).getTime();
}

/**
 * Reminder fire instant: configured hour MYT on (deadline date − days_before_expiry).
 * `reminderHour` is 0–23 whole hours (platform default 9).
 */
export function computeReminderFireAt(
  expiresAtIso: string,
  daysBeforeExpiry: number,
  reminderHour: number = DEFAULT_OFFER_DEADLINE_REMINDER_HOUR
): Date {
  const lastValidDay = mytLastValidDayFromExpiresAt(expiresAtIso);
  const reminderDay = addMytCalendarDays(lastValidDay, -daysBeforeExpiry);
  const hour = Math.min(23, Math.max(0, Math.trunc(reminderHour)));
  return mytHourOnDayUtc(reminderDay, hour);
}

const MYT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Display label for the inclusive deadline: "06 Aug 2026, 11:59 PM". */
export function formatPhaseDeadlineAbsolute(expiresAtIso: string): string {
  const lastValid = mytLastValidDayFromExpiresAt(expiresAtIso);
  const month = MYT_MONTHS[lastValid.month - 1] ?? "???";
  const day = String(lastValid.day).padStart(2, "0");
  return `${day} ${month} ${lastValid.year}, 11:59 PM`;
}

/** Calendar days from `now` until the inclusive deadline date (0 = deadline day). */
export function mytCalendarDaysUntilDeadline(expiresAtIso: string, now: Date = new Date()): number {
  const lastValid = mytLastValidDayFromExpiresAt(expiresAtIso);
  const today = mytCalendarParts(now);
  return mytCalendarDayDiff(today, lastValid);
}

/** Parse a phase deadline blob; returns null when missing/invalid days. */
export function parsePhaseDeadlineConfig(value: unknown): PhaseDeadlineConfig | null {
  const root = asRecord(value);
  if (!root) return null;
  const days = parseOptionalPositiveInt(root.days);
  if (days == null) return null;
  const reminders: DeadlineReminderConfig[] = [];
  const seen = new Set<number>();
  if (Array.isArray(root.reminders)) {
    for (const row of root.reminders) {
      const r = asRecord(row);
      if (!r) continue;
      const daysBefore = parseNonNegativeInt(r.days_before_expiry);
      if (daysBefore == null || daysBefore >= days || seen.has(daysBefore)) continue;
      seen.add(daysBefore);
      reminders.push({ days_before_expiry: daysBefore });
    }
  }
  reminders.sort((a, b) => b.days_before_expiry - a.days_before_expiry);
  return { days, reminders };
}

export function serializePhaseDeadlineConfig(config: PhaseDeadlineConfig): PhaseDeadlineConfig {
  const seen = new Set<number>();
  const reminders: DeadlineReminderConfig[] = [];
  for (const row of config.reminders ?? []) {
    const daysBefore = row.days_before_expiry;
    if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore >= config.days) continue;
    if (seen.has(daysBefore)) continue;
    seen.add(daysBefore);
    reminders.push({ days_before_expiry: daysBefore });
  }
  reminders.sort((a, b) => b.days_before_expiry - a.days_before_expiry);
  return { days: config.days, reminders };
}

/** Validate shape; throws Error with message (API layer maps to AppError). */
export function assertPhaseDeadlineConfigValid(
  config: PhaseDeadlineConfig | null | undefined,
  label: string
): void {
  if (config == null) {
    throw new Error(`${label} is required`);
  }
  if (!Number.isInteger(config.days) || config.days <= 0) {
    throw new Error(`${label} days must be an integer greater than 0`);
  }
  const seen = new Set<number>();
  for (const row of config.reminders ?? []) {
    if (!Number.isInteger(row.days_before_expiry) || row.days_before_expiry < 0) {
      throw new Error(`${label} reminder days_before_expiry must be a non-negative integer`);
    }
    if (row.days_before_expiry >= config.days) {
      throw new Error(`${label} reminder days_before_expiry must be less than deadline days`);
    }
    if (seen.has(row.days_before_expiry)) {
      throw new Error(`${label} reminder days_before_expiry values must be unique`);
    }
    seen.add(row.days_before_expiry);
  }
}

/** DD/MM/YYYY for the inclusive deadline date (emails / notifications). */
export function formatPhaseDeadlineDateDDMMYYYY(expiresAtIso: string): string {
  const lastValid = mytLastValidDayFromExpiresAt(expiresAtIso);
  const day = String(lastValid.day).padStart(2, "0");
  const month = String(lastValid.month).padStart(2, "0");
  return `${day}/${month}/${lastValid.year}`;
}

/** @deprecated Use computePhaseDeadlineExpiresAt for phase clocks. */
export function addDaysIso(fromIso: string | Date, days: number): string {
  return computePhaseDeadlineExpiresAt(fromIso, days);
}

/** @deprecated Use computeReminderFireAt with platform reminder hour. */
export function reminderFireAt(expiresAtIso: string, daysBeforeExpiry: number): Date {
  return computeReminderFireAt(expiresAtIso, daysBeforeExpiry);
}

export function deadlineReminderKey(
  clock: "acceptance" | "signing",
  daysBeforeExpiry: number
): string {
  return `${clock}:${daysBeforeExpiry}`;
}

/** Validate platform reminder hour (whole hours 0–23). */
export function assertOfferDeadlineReminderHourValid(hour: number): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("Offer deadline reminder hour must be an integer from 0 to 23");
  }
}
