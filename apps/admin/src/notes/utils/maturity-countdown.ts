/** Highlight notes whose maturity is this many calendar days away or closer. */
export const NEAR_MATURITY_DAYS = 30;

const DAY_MS = 86_400_000;
const PAST_DUE_CLASS = "text-status-rejected-text";
const NEAR_CLASS = "text-status-action-text";
const SETTLED_CLASS = "text-status-success-text";

function startOfLocalDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayCountLabel(count: number): string {
  return `${count} day${count === 1 ? "" : "s"}`;
}

/** Signed local calendar days from today to maturity (negative = already passed). */
export function calendarDaysUntilMaturity(
  maturityDate: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!maturityDate) return null;
  const target = new Date(maturityDate);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((startOfLocalDayMs(target) - startOfLocalDayMs(now)) / DAY_MS);
}

/** Compact relative label, e.g. "in 12 days", "today", "3 days ago". */
export function formatMaturityCountdown(
  maturityDate: string | null | undefined,
  now: Date = new Date()
): string | null {
  const days = calendarDaysUntilMaturity(maturityDate, now);
  if (days == null) return null;
  if (days === 0) return "today";
  if (days > 0) return `in ${dayCountLabel(days)}`;
  return `${dayCountLabel(Math.abs(days))} ago`;
}

/** Header subtitle for payment due, e.g. "Due in 12 days", "Due today", "Overdue by 3 days". */
export function formatPaymentDueHint(
  dueDate: string | null | undefined,
  now: Date = new Date()
): string | null {
  const days = calendarDaysUntilMaturity(dueDate, now);
  if (days == null) return null;
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${dayCountLabel(days)}`;
  return `Overdue by ${dayCountLabel(Math.abs(days))}`;
}

/**
 * Colour for the date and countdown. Past due is red; within 30 days is yellow.
 * Posted settlement uses success green so repaid rows do not look like live alerts.
 */
export function maturityCountdownClass(
  days: number | null,
  options?: { highlight?: boolean; variant?: "date" | "countdown"; settled?: boolean }
): string {
  if (options?.settled) return SETTLED_CLASS;
  const fallback = options?.variant === "date" ? "" : "text-muted-foreground";
  if (days == null || options?.highlight === false) return fallback;
  if (days < 0) return PAST_DUE_CLASS;
  if (days <= NEAR_MATURITY_DAYS) return NEAR_CLASS;
  return fallback;
}

export function isNoteInArrears(note: {
  status: string;
  servicingStatus?: string | null;
}): boolean {
  return note.status === "ARREARS" || note.servicingStatus === "ARREARS";
}

/** Active notes with maturity today, within 30 days, or already past. */
export function isActiveNearMaturity(
  note: { status: string; maturityDate: string | null | undefined },
  now: Date = new Date()
): boolean {
  if (note.status !== "ACTIVE") return false;
  const days = calendarDaysUntilMaturity(note.maturityDate, now);
  return days != null && days <= NEAR_MATURITY_DAYS;
}
