import { DpdBucket, NoteServicingStatus, NoteStatus } from "@prisma/client";
import { NOTE_MONEY_DECIMALS, roundNoteMoney } from "@cashsouk/types";
import { calculateCalendarDayCount, calculateLateCharge } from "./calculators";

function money(value: number) {
  return roundNoteMoney(value, NOTE_MONEY_DECIMALS);
}

export type ClassifiableNote = {
  servicing_status: NoteServicingStatus;
  status: NoteStatus;
  grace_period_days: number;
  arrears_threshold_days: number;
  tawidh_rate_cap_percent: number;
  gharamah_rate_cap_percent: number;
  due_date: Date | null;
  receipt_amount: number;
  applied_tawidh_amount?: number;
  applied_gharamah_amount?: number;
  waived_tawidh_amount?: number;
  waived_gharamah_amount?: number;
};

export type ServicingClassification = {
  servicingStatus: NoteServicingStatus;
  noteStatus: NoteStatus | null;
  daysPastDue: number;
  daysAfterGrace: number;
  daysUntilDue: number | null;
  dpdBucket: DpdBucket;
  isScDefault: boolean;
  indicativeTawidhAmount: number;
  indicativeGharamahAmount: number;
  dueDate: Date | null;
};

const SERVICING_RANK: Record<NoteServicingStatus, number> = {
  [NoteServicingStatus.NOT_STARTED]: 0,
  [NoteServicingStatus.CURRENT]: 1,
  [NoteServicingStatus.PARTIAL]: 1,
  [NoteServicingStatus.ADVANCE_PAID]: 1,
  [NoteServicingStatus.OVERDUE]: 2,
  [NoteServicingStatus.LATE]: 3,
  [NoteServicingStatus.ARREARS]: 4,
  [NoteServicingStatus.DEFAULTED]: 5,
  [NoteServicingStatus.SETTLED]: 6,
};

export function dpdBucketFromDays(daysPastDue: number): DpdBucket {
  if (daysPastDue <= 0) return DpdBucket.CURRENT;
  if (daysPastDue <= 30) return DpdBucket.DPD_1_30;
  if (daysPastDue <= 60) return DpdBucket.DPD_31_60;
  if (daysPastDue <= 90) return DpdBucket.DPD_61_90;
  return DpdBucket.DPD_90_PLUS;
}

export function shouldAdvanceServicing(
  current: NoteServicingStatus,
  next: NoteServicingStatus
): boolean {
  if (
    current === NoteServicingStatus.DEFAULTED ||
    current === NoteServicingStatus.SETTLED
  ) {
    return false;
  }
  return SERVICING_RANK[next] > SERVICING_RANK[current];
}

export function classifyServicing(
  note: ClassifiableNote,
  today: Date
): ServicingClassification {
  const dueDate = note.due_date;
  if (!dueDate) {
    return {
      servicingStatus: NoteServicingStatus.CURRENT,
      noteStatus: null,
      daysPastDue: 0,
      daysAfterGrace: 0,
      daysUntilDue: null,
      dpdBucket: DpdBucket.CURRENT,
      isScDefault: false,
      indicativeTawidhAmount: 0,
      indicativeGharamahAmount: 0,
      dueDate: null,
    };
  }

  const asOf = calendarDateInTimeZone(today);
  const due = calendarDateInTimeZone(dueDate);
  const daysPastDue = calculateCalendarDayCount(due, asOf);
  const daysUntilDue =
    daysPastDue > 0 ? 0 : calculateCalendarDayCount(asOf, due);
  const daysAfterGrace = Math.max(0, daysPastDue - note.grace_period_days);
  const lateCharge = calculateLateCharge({
    receiptAmount: note.receipt_amount,
    dueDate: due,
    receiptDate: asOf,
    gracePeriodDays: note.grace_period_days,
    tawidhRateCapPercent: note.tawidh_rate_cap_percent,
    gharamahRateCapPercent: note.gharamah_rate_cap_percent,
  });
  const indicativeTawidhAmount = money(
    Math.max(
      0,
      lateCharge.tawidhCap -
        (note.applied_tawidh_amount ?? 0) -
        (note.waived_tawidh_amount ?? 0)
    )
  );
  const indicativeGharamahAmount = money(
    Math.max(
      0,
      lateCharge.gharamahCap -
        (note.applied_gharamah_amount ?? 0) -
        (note.waived_gharamah_amount ?? 0)
    )
  );

  let servicingStatus: NoteServicingStatus = NoteServicingStatus.CURRENT;
  let noteStatus: NoteStatus | null = null;
  if (daysPastDue > 0 && daysAfterGrace <= 0) {
    servicingStatus = NoteServicingStatus.OVERDUE;
  } else if (daysAfterGrace > 0 && daysAfterGrace < note.arrears_threshold_days) {
    servicingStatus = NoteServicingStatus.LATE;
  } else if (daysAfterGrace >= note.arrears_threshold_days) {
    servicingStatus = NoteServicingStatus.ARREARS;
    noteStatus = NoteStatus.ARREARS;
  }

  return {
    servicingStatus,
    noteStatus,
    daysPastDue,
    daysAfterGrace,
    daysUntilDue,
    dpdBucket: dpdBucketFromDays(daysPastDue),
    isScDefault: daysPastDue > 90,
    indicativeTawidhAmount,
    indicativeGharamahAmount,
    dueDate,
  };
}

export function resolveServicingDueDate(note: {
  maturity_date?: Date | null;
  payment_schedules?: Array<{ due_date: Date | null; sequence?: number | null }>;
}): Date | null {
  const schedules = [...(note.payment_schedules ?? [])].sort(
    (left, right) => (left.sequence ?? 0) - (right.sequence ?? 0)
  );
  return schedules[0]?.due_date ?? note.maturity_date ?? null;
}

export function calendarDateInTimeZone(
  now: Date,
  timeZone = "Asia/Kuala_Lumpur"
): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${parts}T00:00:00.000Z`);
}

export function calendarDaysBetween(
  start: Date,
  end: Date,
  timeZone = "Asia/Kuala_Lumpur"
) {
  return calculateCalendarDayCount(
    calendarDateInTimeZone(start, timeZone),
    calendarDateInTimeZone(end, timeZone)
  );
}

export function tenureDaysForNote(note: {
  tenure_days?: number | null;
  disbursement_value_date?: Date | null;
  activated_at?: Date | null;
  maturity_date?: Date | null;
}): number {
  if (note.tenure_days && note.tenure_days > 0) return note.tenure_days;
  const start = note.disbursement_value_date ?? note.activated_at;
  if (!start || !note.maturity_date) return 0;
  return calculateCalendarDayCount(
    calendarDateInTimeZone(start),
    calendarDateInTimeZone(note.maturity_date)
  );
}

export function noteOutstandingAmounts(input: {
  fundedAmount: number;
  recoveredPrincipal: number;
  recoveredProfit: number;
  profitRatePercent: number;
  tenureDays: number;
}) {
  const outstandingPrincipal = money(Math.max(0, input.fundedAmount - input.recoveredPrincipal));
  const contractualProfit =
    input.fundedAmount * (input.profitRatePercent / 100) * (input.tenureDays / 365);
  const outstandingProfit = money(Math.max(0, contractualProfit - input.recoveredProfit));
  return {
    outstandingPrincipal,
    outstandingProfit,
    outstandingTotal: money(outstandingPrincipal + outstandingProfit),
  };
}
