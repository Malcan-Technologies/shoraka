import {
  isNoteFullyFunded,
  malaysiaCalendarDaysRemaining,
  mytCalendarParts,
  roundNoteMoney,
  type IssuerDashboardBook,
  type IssuerBookCostOfFinancingYtd,
  type IssuerBookFundingProgress,
  type IssuerBookOutstandingPoint,
  type IssuerBookRepaymentMonth,
} from "@cashsouk/types";
import {
  formatYearMonthLabel,
  malaysiaDateKey,
  nextMytYearMonths,
  snapshotName,
} from "../notes/investor-dashboard-metrics";
import {
  noteOutstandingAmounts,
  resolveServicingDueDate,
  tenureDaysForNote,
} from "../notes/servicing-classifier";

const LIVE_NOTE_STATUSES = new Set(["ACTIVE", "ARREARS", "DEFAULTED"]);
const CLOSED_NOTE_STATUSES = new Set(["REPAID", "CANCELLED", "FAILED_FUNDING"]);
const OPEN_NOTE_STATUSES = new Set(["PUBLISHED", "FUNDING"]);

export type IssuerBookNoteInput = {
  id: string;
  noteReference: string;
  status: string;
  listingStatus?: string | null;
  fundingStatus: string;
  servicingStatus: string;
  fundedAmount: number;
  targetAmount: number;
  recoveredPrincipal: number;
  recoveredProfit: number;
  profitRatePercent: number;
  tenureDays: number | null;
  disbursementValueDate?: Date | null;
  activatedAt?: Date | null;
  maturityDate?: Date | null;
  paymentSchedules?: Array<{ due_date: Date | null; sequence?: number | null }>;
  listingClosesAt?: Date | null;
  paymasterSnapshot?: unknown;
  invoiceSnapshot?: unknown;
};

function isLiveFundedNote(note: IssuerBookNoteInput): boolean {
  if (CLOSED_NOTE_STATUSES.has(note.status) || note.servicingStatus === "SETTLED") return false;
  if (note.fundedAmount <= 0) return false;
  return LIVE_NOTE_STATUSES.has(note.status);
}

const FUNDING_STATUS_RANK: Record<IssuerBookFundingProgress["status"], number> = {
  failed: 0,
  pending_listing: 1,
  open: 2,
  funded: 3,
};

function fundingProgressStatus(
  note: IssuerBookNoteInput
): IssuerBookFundingProgress["status"] | null {
  if (note.status === "CANCELLED" || note.status === "REPAID") return null;
  if (LIVE_NOTE_STATUSES.has(note.status)) return null;
  if (note.status === "FAILED_FUNDING" || note.fundingStatus === "FAILED") return "failed";
  if (isNoteFullyFunded(note.fundedAmount, note.targetAmount) || note.fundingStatus === "FUNDED") {
    return "funded";
  }
  if (OPEN_NOTE_STATUSES.has(note.status) || note.fundingStatus === "OPEN") return "open";
  const listing = String(note.listingStatus ?? "").toUpperCase();
  if (
    note.status === "DRAFT" ||
    listing === "NOT_LISTED" ||
    listing === "DRAFT" ||
    listing === "UNPUBLISHED"
  ) {
    return "pending_listing";
  }
  return null;
}

function noteOutstanding(note: IssuerBookNoteInput) {
  return noteOutstandingAmounts({
    fundedAmount: note.fundedAmount,
    recoveredPrincipal: note.recoveredPrincipal,
    recoveredProfit: note.recoveredProfit,
    profitRatePercent: note.profitRatePercent,
    tenureDays: tenureDaysForNote({
      tenure_days: note.tenureDays,
      disbursement_value_date: note.disbursementValueDate,
      activated_at: note.activatedAt,
      maturity_date: note.maturityDate,
    }),
  });
}

export function resolvePaymasterDisplayName(
  paymasterSnapshot: unknown,
  invoiceSnapshot?: unknown
): string | null {
  const fromPaymaster = snapshotName(paymasterSnapshot, [
    "name",
    "company_name",
    "business_name",
    "legal_name",
  ]);
  if (fromPaymaster) return fromPaymaster;
  if (!invoiceSnapshot || typeof invoiceSnapshot !== "object" || Array.isArray(invoiceSnapshot)) {
    return null;
  }
  const invoice = invoiceSnapshot as Record<string, unknown>;
  return (
    snapshotName(invoice.customer, ["name", "company_name", "legal_name"]) ??
    snapshotName(invoice.paymaster, ["name", "company_name", "legal_name"]) ??
    snapshotName(invoice, ["customer_name", "paymaster_name"])
  );
}

export function computeIssuerOutstandingBook(notes: readonly IssuerBookNoteInput[]): {
  outstandingAmount: number;
  liveNoteCount: number;
} {
  const live = notes.filter(isLiveFundedNote);
  return {
    outstandingAmount: roundNoteMoney(
      live.reduce((sum, note) => sum + noteOutstanding(note).outstandingTotal, 0),
      2
    ),
    liveNoteCount: live.length,
  };
}

export function computeNextRepayment(
  notes: readonly IssuerBookNoteInput[],
  now: Date
): IssuerDashboardBook["nextRepayment"] {
  const live = notes.filter(isLiveFundedNote);
  let earliest: {
    note: IssuerBookNoteInput;
    due: Date;
    dueKey: string;
  } | null = null;
  for (const note of live) {
    const due = resolveServicingDueDate({
      maturity_date: note.maturityDate,
      payment_schedules: note.paymentSchedules,
    });
    if (!due) continue;
    const dueKey = malaysiaDateKey(due);
    if (!earliest || dueKey < earliest.dueKey) {
      earliest = { note, due, dueKey };
    }
  }
  if (!earliest) return null;
  const outstanding = noteOutstanding(earliest.note);
  const daysRemaining = malaysiaCalendarDaysRemaining(now, earliest.due);
  return {
    noteId: earliest.note.id,
    noteReference: earliest.note.noteReference,
    amount: outstanding.outstandingTotal,
    profit: outstanding.outstandingProfit,
    dueDate: earliest.dueKey,
    daysRemaining,
    paymasterName: resolvePaymasterDisplayName(
      earliest.note.paymasterSnapshot,
      earliest.note.invoiceSnapshot
    ),
  };
}

function liveNotesWithDue(notes: readonly IssuerBookNoteInput[]) {
  return notes.flatMap((note) => {
    if (!isLiveFundedNote(note)) return [];
    const due = resolveServicingDueDate({
      maturity_date: note.maturityDate,
      payment_schedules: note.paymentSchedules,
    });
    if (!due) return [];
    const outstanding = noteOutstanding(note);
    return [
      {
        note,
        dueKey: malaysiaDateKey(due),
        amount: outstanding.outstandingTotal,
        profit: outstanding.outstandingProfit,
      },
    ];
  });
}

export function computeRepaymentSchedule(
  notes: readonly IssuerBookNoteInput[],
  now: Date,
  monthLimit = 4
): IssuerBookRepaymentMonth[] {
  const rows = liveNotesWithDue(notes);
  const byMonth = new Map<string, IssuerBookRepaymentMonth>();
  for (const row of rows) {
    const yearMonth = row.dueKey.slice(0, 7);
    const current = byMonth.get(yearMonth) ?? {
      yearMonth,
      label: formatYearMonthLabel(yearMonth),
      amount: 0,
      count: 0,
    };
    current.amount = roundNoteMoney(current.amount + row.amount, 2);
    current.count += 1;
    byMonth.set(yearMonth, current);
  }
  const todayMonth = nextMytYearMonths(now, 1)[0];
  return [...byMonth.values()]
    .filter((month) => month.yearMonth >= todayMonth)
    .sort((left, right) => left.yearMonth.localeCompare(right.yearMonth))
    .slice(0, monthLimit);
}

export function computeUpcomingRepayments(
  notes: readonly IssuerBookNoteInput[],
  limit = 3
): IssuerDashboardBook["upcomingRepayments"] {
  return liveNotesWithDue(notes)
    .sort((left, right) => {
      if (left.dueKey !== right.dueKey) return left.dueKey.localeCompare(right.dueKey);
      return left.note.noteReference.localeCompare(right.note.noteReference);
    })
    .slice(0, limit)
    .map((row) => ({
      noteId: row.note.id,
      noteReference: row.note.noteReference,
      dueDate: row.dueKey,
      amount: row.amount,
      profit: row.profit,
      paymasterName: resolvePaymasterDisplayName(row.note.paymasterSnapshot, row.note.invoiceSnapshot),
    }));
}

export function computeFundingProgress(
  notes: readonly IssuerBookNoteInput[],
  now: Date
): IssuerBookFundingProgress[] {
  return notes
    .map((note) => {
      const status = fundingProgressStatus(note);
      if (!status) return null;
      const percent =
        note.targetAmount > 0
          ? Math.max(0, Math.min(100, roundNoteMoney((note.fundedAmount / note.targetAmount) * 100, 2)))
          : 0;
      return {
        noteId: note.id,
        noteReference: note.noteReference,
        tenorDays: note.tenureDays,
        daysLeft: note.listingClosesAt
          ? malaysiaCalendarDaysRemaining(now, note.listingClosesAt)
          : null,
        fundedAmount: roundNoteMoney(note.fundedAmount, 2),
        targetAmount: roundNoteMoney(note.targetAmount, 2),
        percent,
        status,
      };
    })
    .filter((row): row is IssuerBookFundingProgress => row != null)
    .sort((left, right) => {
      const rank = FUNDING_STATUS_RANK[left.status] - FUNDING_STATUS_RANK[right.status];
      if (rank !== 0) return rank;
      return left.noteReference.localeCompare(right.noteReference);
    });
}

export type PositionSnapshotInput = {
  noteId: string;
  snapshotDate: Date;
  outstandingTotal: number;
};

function snapshotDateKey(snapshotDate: Date): string {
  return malaysiaDateKey(snapshotDate);
}

function monthEndDate(yearMonth: string): string {
  const [yearRaw, monthRaw] = yearMonth.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
}

export function computeOutstandingOverTime(
  snapshots: readonly PositionSnapshotInput[],
  currentApprovedLimit: number | null,
  now = new Date()
): IssuerBookOutstandingPoint[] {
  const cutoffMonth = yearMonthMonthsAgo(now, 11);
  const lastInMonthByNote = new Map<string, Map<string, { dateKey: string; outstandingTotal: number }>>();
  for (const snapshot of snapshots) {
    const dateKey = snapshotDateKey(snapshot.snapshotDate);
    const yearMonth = dateKey.slice(0, 7);
    if (yearMonth < cutoffMonth) continue;
    const byNote = lastInMonthByNote.get(yearMonth) ?? new Map();
    const previous = byNote.get(snapshot.noteId);
    if (!previous || dateKey >= previous.dateKey) {
      byNote.set(snapshot.noteId, { dateKey, outstandingTotal: snapshot.outstandingTotal });
    }
    lastInMonthByNote.set(yearMonth, byNote);
  }
  const points = [...lastInMonthByNote.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([yearMonth, byNote]) => ({
      date: monthEndDate(yearMonth),
      drawn: roundNoteMoney(
        [...byNote.values()].reduce((sum, row) => sum + row.outstandingTotal, 0),
        2
      ),
      limit: currentApprovedLimit,
    }));
  return points.length >= 2 ? points : [];
}

function yearMonthMonthsAgo(now: Date, monthsBack: number): string {
  const parts = mytCalendarParts(now);
  const shifted = parts.month - monthsBack;
  const year = parts.year + Math.floor((shifted - 1) / 12);
  const month = ((shifted % 12) + 12) % 12 || 12;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export type CostOfFinancingInput = {
  now: Date;
  profitOnNotes: number;
  drawdownFees: number;
  facilityFees: number;
  tawidh: number;
  amountDrawnThisYear: number;
};

export function computeCostOfFinancingYtd(input: CostOfFinancingInput): IssuerBookCostOfFinancingYtd {
  const year = mytCalendarParts(input.now).year;
  const profitOnNotes = roundNoteMoney(Math.max(0, input.profitOnNotes), 2);
  const drawdownFees = roundNoteMoney(Math.max(0, input.drawdownFees), 2);
  const facilityFees = roundNoteMoney(Math.max(0, input.facilityFees), 2);
  const tawidh = roundNoteMoney(Math.max(0, input.tawidh), 2);
  const total = roundNoteMoney(profitOnNotes + drawdownFees + facilityFees + tawidh, 2);
  const drawn = input.amountDrawnThisYear;
  return {
    year,
    total,
    profitOnNotes,
    drawdownFees,
    facilityFees,
    tawidh,
    effectivePercent: drawn > 0 ? roundNoteMoney((total / drawn) * 100, 2) : null,
  };
}

export function computeFacilityLimitSummary(input: {
  approved: number[];
  available: number[];
  drawn: number[];
}): Pick<IssuerDashboardBook, "availableLimit" | "approvedLimit" | "drawnAmount" | "drawnPercent"> {
  if (input.approved.length === 0) {
    return {
      availableLimit: null,
      approvedLimit: null,
      drawnAmount: null,
      drawnPercent: null,
    };
  }
  const approvedLimit = roundNoteMoney(
    input.approved.reduce((sum, value) => sum + value, 0),
    2
  );
  const availableLimit = roundNoteMoney(
    input.available.reduce((sum, value) => sum + value, 0),
    2
  );
  const drawnAmount = roundNoteMoney(
    input.drawn.reduce((sum, value) => sum + value, 0),
    2
  );
  return {
    availableLimit,
    approvedLimit,
    drawnAmount,
    drawnPercent: approvedLimit > 0 ? roundNoteMoney((drawnAmount / approvedLimit) * 100, 2) : null,
  };
}

export function isInstantInMytYear(value: Date, now: Date): boolean {
  return mytCalendarParts(value).year === mytCalendarParts(now).year;
}

export function buildIssuerDashboardBook(input: {
  now: Date;
  notes: readonly IssuerBookNoteInput[];
  snapshots: readonly PositionSnapshotInput[];
  facility: ReturnType<typeof computeFacilityLimitSummary>;
  cost: CostOfFinancingInput;
}): IssuerDashboardBook {
  const outstanding = computeIssuerOutstandingBook(input.notes);
  return {
    outstandingAmount: outstanding.outstandingAmount,
    liveNoteCount: outstanding.liveNoteCount,
    nextRepayment: computeNextRepayment(input.notes, input.now),
    ...input.facility,
    repaymentSchedule: computeRepaymentSchedule(input.notes, input.now),
    upcomingRepayments: computeUpcomingRepayments(input.notes),
    fundingProgress: computeFundingProgress(input.notes, input.now),
    outstandingOverTime: computeOutstandingOverTime(input.snapshots, input.facility.approvedLimit),
    costOfFinancingYtd: computeCostOfFinancingYtd(input.cost),
  };
}
