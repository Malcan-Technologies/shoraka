/**
 * Configurable phase deadlines (acceptance / signing clocks) on financing-type workflow config.
 */

export type DeadlineReminderConfig = {
  /** Days before expires_at when a reminder should fire (0 = on expiry day). */
  days_before_expiry: number;
};

export type PhaseDeadlineConfig = {
  days: number;
  reminders: DeadlineReminderConfig[];
};

export const ACCEPTANCE_DEADLINE_WORKFLOW_KEY = "acceptance_deadline";
export const SIGNING_DEADLINE_WORKFLOW_KEY = "signing_deadline";

export const DEFAULT_ACCEPTANCE_DEADLINE: PhaseDeadlineConfig = {
  days: 7,
  reminders: [{ days_before_expiry: 1 }],
};

export const DEFAULT_SIGNING_DEADLINE: PhaseDeadlineConfig = {
  days: 14,
  reminders: [{ days_before_expiry: 3 }, { days_before_expiry: 1 }],
};

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

export function addDaysIso(fromIso: string | Date, days: number): string {
  const base = typeof fromIso === "string" ? new Date(fromIso) : fromIso;
  const ms = base.getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export function reminderFireAt(expiresAtIso: string, daysBeforeExpiry: number): Date {
  return new Date(new Date(expiresAtIso).getTime() - daysBeforeExpiry * 24 * 60 * 60 * 1000);
}

export function deadlineReminderKey(
  clock: "acceptance" | "signing",
  daysBeforeExpiry: number
): string {
  return `${clock}:${daysBeforeExpiry}`;
}
