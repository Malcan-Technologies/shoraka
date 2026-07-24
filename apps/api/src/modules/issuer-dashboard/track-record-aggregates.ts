/**
 * SECTION: Shared issuer track-record aggregates
 * WHY: One formula for dashboard on-time + prospectus Stage 7; avoid duplicated schedule math
 */

import { NoteStatus } from "@prisma/client";

/** Prospectus funded-history statuses (broader than dashboard ACTIVE+REPAID overview). */
export const PROSPECTUS_FUNDED_HISTORY_STATUSES: readonly NoteStatus[] = [
  NoteStatus.ACTIVE,
  NoteStatus.REPAID,
  NoteStatus.ARREARS,
  NoteStatus.DEFAULTED,
] as const;

export const PROSPECTUS_FUNDED_HISTORY_STATUS_SET = new Set<string>(
  PROSPECTUS_FUNDED_HISTORY_STATUSES
);

export type TrackRecordNoteRow = {
  id: string;
  status: NoteStatus | string;
  funded_amount: unknown;
};

export type OnTimeScheduleRow = {
  id: string;
  note_id: string;
  due_date: Date;
  expected_total: unknown;
};

export type OnTimePaymentRow = {
  schedule_id: string | null;
  receipt_date: Date;
  receipt_amount: unknown;
};

export function decimalToNumber(value: unknown): number {
  if (value != null && typeof value === "object" && "toNumber" in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function decimalToSerializableString(value: unknown): string | null {
  if (value == null) return null;
  if (value != null && typeof value === "object" && "toString" in value) {
    const s = (value as { toString: () => string }).toString();
    return s.length > 0 ? s : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

function isEligibleFundedHistoryNote(
  note: TrackRecordNoteRow,
  excludeNoteId?: string | null
): boolean {
  if (excludeNoteId && note.id === excludeNoteId) return false;
  return PROSPECTUS_FUNDED_HISTORY_STATUS_SET.has(String(note.status));
}

/** Total Notes Funded — prospectus definition. */
export function countProspectusTotalNotesFunded(
  notes: TrackRecordNoteRow[],
  excludeNoteId?: string | null
): number {
  return notes.filter((n) => isEligibleFundedHistoryNote(n, excludeNoteId)).length;
}

/** Total Amount Funded — SUM(funded_amount); never substitutes target_amount. */
export function sumProspectusTotalAmountFunded(
  notes: TrackRecordNoteRow[],
  excludeNoteId?: string | null
): number {
  return notes
    .filter((n) => isEligibleFundedHistoryNote(n, excludeNoteId))
    .reduce((sum, n) => sum + decimalToNumber(n.funded_amount), 0);
}

/**
 * Successful Repayment % = REPAID / (REPAID + ARREARS + DEFAULTED) × 100.
 * ACTIVE excluded from denominator. Null when denominator is 0.
 */
export function computeProspectusSuccessfulRepaymentPercent(
  notes: TrackRecordNoteRow[],
  excludeNoteId?: string | null
): number | null {
  let repaid = 0;
  let arrears = 0;
  let defaulted = 0;
  for (const note of notes) {
    if (excludeNoteId && note.id === excludeNoteId) continue;
    if (note.status === NoteStatus.REPAID) repaid += 1;
    else if (note.status === NoteStatus.ARREARS) arrears += 1;
    else if (note.status === NoteStatus.DEFAULTED) defaulted += 1;
  }
  const denominator = repaid + arrears + defaulted;
  if (denominator === 0) return null;
  return Math.round((repaid / denominator) * 100);
}

export function sixMonthsAgoFrom(now: Date): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - 6);
  return d;
}

export type OnTimePaymentRateResult = {
  onTimePercent: number | null;
  pastDueCount: number | null;
  lateRepaymentsCount: number | null;
  schedulesInWindowCount: number;
};

/**
 * Schedule-level on-time rate for dues in [windowStart, windowEnd].
 * On-time: cumulative RECEIVED ≥ expected_total by due_date.
 * Null rates when no schedules in window (after exclusions).
 */
export function computeOnTimePaymentRate(input: {
  schedules: OnTimeScheduleRow[];
  payments: OnTimePaymentRow[];
  now: Date;
  windowStart: Date;
  excludeNoteId?: string | null;
}): OnTimePaymentRateResult {
  const { schedules, payments, now, windowStart, excludeNoteId } = input;

  const schedulesInWindow = schedules.filter((s) => {
    if (excludeNoteId && s.note_id === excludeNoteId) return false;
    return s.due_date >= windowStart && s.due_date <= now;
  });

  if (schedulesInWindow.length === 0) {
    return {
      onTimePercent: null,
      pastDueCount: null,
      lateRepaymentsCount: null,
      schedulesInWindowCount: 0,
    };
  }

  const paymentsByScheduleId = new Map<
    string,
    Array<{ receipt_date: Date; receipt_amount: number }>
  >();
  for (const p of payments) {
    const sid = p.schedule_id;
    if (!sid) continue;
    const list = paymentsByScheduleId.get(sid) ?? [];
    list.push({
      receipt_date: p.receipt_date,
      receipt_amount: decimalToNumber(p.receipt_amount),
    });
    paymentsByScheduleId.set(sid, list);
  }
  for (const list of paymentsByScheduleId.values()) {
    list.sort((a, b) => a.receipt_date.getTime() - b.receipt_date.getTime());
  }

  let onTimeCount = 0;
  let pastDue = 0;
  let lateCount = 0;

  for (const s of schedulesInWindow) {
    const expectedTotal = decimalToNumber(s.expected_total);
    const schedulePayments = paymentsByScheduleId.get(s.id) ?? [];
    let cumulative = 0;
    let fullyPaidDate: Date | null = null;
    for (const p of schedulePayments) {
      cumulative += p.receipt_amount;
      if (cumulative + 1e-9 >= expectedTotal) {
        fullyPaidDate = p.receipt_date;
        break;
      }
    }

    if (!fullyPaidDate) {
      if (s.due_date < now) pastDue += 1;
      continue;
    }

    if (fullyPaidDate <= s.due_date) onTimeCount += 1;
    else lateCount += 1;
  }

  return {
    onTimePercent: Math.round((onTimeCount / schedulesInWindow.length) * 100),
    pastDueCount: pastDue,
    lateRepaymentsCount: lateCount,
    schedulesInWindowCount: schedulesInWindow.length,
  };
}

export function computeOnTimePaymentRatePercent(input: {
  schedules: OnTimeScheduleRow[];
  payments: OnTimePaymentRow[];
  now: Date;
  windowStart: Date;
  excludeNoteId?: string | null;
}): number | null {
  return computeOnTimePaymentRate(input).onTimePercent;
}
