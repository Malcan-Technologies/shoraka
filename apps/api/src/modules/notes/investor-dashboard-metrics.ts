import {
  addMytCalendarDays,
  malaysiaCalendarDaysRemaining,
  mytCalendarParts,
  mytStartOfDayUtc,
  roundNoteMoney,
  type InvestorCashflowNext90Days,
  type InvestorPortfolioAtRisk,
} from "@cashsouk/types";
import { computeActualReturnRatePercent } from "./calculators";
import {
  calendarDateInTimeZone,
  calendarDaysBetween,
  noteOutstandingAmounts,
  resolveServicingDueDate,
  tenureDaysForNote,
} from "./servicing-classifier";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const AT_RISK_SERVICING = new Set(["OVERDUE", "LATE", "ARREARS", "DEFAULTED"]);
const AT_RISK_NOTE_STATUS = new Set(["ARREARS", "DEFAULTED"]);
const CLOSED_NOTE_STATUS = new Set(["SETTLED", "REPAID", "CANCELLED", "FAILED_FUNDING"]);

export function malaysiaDateKey(value: Date, timeZone = "Asia/Kuala_Lumpur"): string {
  return calendarDateInTimeZone(value, timeZone).toISOString().slice(0, 10);
}

export function formatYearMonthLabel(yearMonth: string): string {
  const [yearRaw, monthRaw] = yearMonth.split("-");
  const month = Number(monthRaw);
  const label = MONTH_LABELS[month - 1];
  return label ? `${label} ${yearRaw}` : yearMonth;
}

export function nextMytYearMonths(now: Date, count: number): string[] {
  const start = mytCalendarParts(now);
  const months: string[] = [];
  let year = start.year;
  let month = start.month;
  for (let index = 0; index < count; index += 1) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function mytYearMonthsThrough(from: Date, through: Date): string[] {
  const start = mytCalendarParts(from);
  const end = mytCalendarParts(through);
  const months: string[] = [];
  let year = start.year;
  let month = start.month;
  const endKey = `${end.year}-${String(end.month).padStart(2, "0")}`;
  while (months.length < 24) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= endKey) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function idleDaysSince(lastPostedAt: Date | null | undefined, now: Date): number | null {
  if (!lastPostedAt) return null;
  return Math.max(0, calendarDaysBetween(lastPostedAt, now));
}

export function ytdChangePercent(
  currentTotal: number,
  startOfYearTotal: number | null
): number | null {
  if (startOfYearTotal == null || startOfYearTotal <= 0) return null;
  return roundNoteMoney(((currentTotal - startOfYearTotal) / startOfYearTotal) * 100, 2);
}

export function portfolioTotalBefore(
  openingPortfolioTotal: number,
  events: readonly { at: Date; delta: number }[],
  untilExclusive: Date
): number {
  let carry = openingPortfolioTotal;
  for (const event of [...events].sort((left, right) => left.at.getTime() - right.at.getTime())) {
    if (event.at.getTime() >= untilExclusive.getTime()) break;
    carry += event.delta;
  }
  return roundNoteMoney(carry, 2);
}

export function returnsSinceDate(confirmedAt: Date | null | undefined): string | null {
  if (!confirmedAt) return null;
  return malaysiaDateKey(confirmedAt);
}

export type SettlementAllocationInput = {
  investorOrganizationId: string;
  principal: number;
  profitNet: number;
  tawidhInvestorShare: number;
};

export function sumReturnsEarned(
  allocations: readonly SettlementAllocationInput[],
  investorOrganizationIds: ReadonlySet<string>
): number {
  const total = allocations
    .filter((allocation) => investorOrganizationIds.has(allocation.investorOrganizationId))
    .reduce((sum, allocation) => sum + allocation.profitNet, 0);
  return roundNoteMoney(total, 2);
}

export function uniqueSettlementsById<T extends { id: string }>(
  holdings: readonly { note: { settlements: readonly T[] } }[]
): T[] {
  const unique = new Map<string, T>();
  for (const holding of holdings) {
    for (const settlement of holding.note.settlements) {
      unique.set(settlement.id, settlement);
    }
  }
  return [...unique.values()];
}

export type SettledReturnInput = {
  investedPrincipal: number;
  receivedProfitNetAmount: number;
  receivedTawidhCompensationAmount: number;
  profitDays: number | null;
};

export function averageNetAnnualReturnPercent(
  settled: readonly SettledReturnInput[]
): number | null {
  let weighted = 0;
  let weight = 0;
  for (const row of settled) {
    const rate = computeActualReturnRatePercent(row);
    if (rate == null) continue;
    weighted += rate * row.investedPrincipal;
    weight += row.investedPrincipal;
  }
  if (weight <= 0) return null;
  return roundNoteMoney(weighted / weight, 2);
}

export type PrincipalEvent = {
  dateKey: string;
  delta: number;
};

export function reconstructPrincipalOnDates(
  events: readonly PrincipalEvent[],
  dateKeys: readonly string[],
  liveConfirmed: number
): number[] {
  const ordered = [...events].sort((left, right) => left.dateKey.localeCompare(right.dateKey));
  let carry = 0;
  let eventIndex = 0;
  const values: number[] = [];
  for (const dateKey of dateKeys) {
    while (eventIndex < ordered.length && ordered[eventIndex].dateKey <= dateKey) {
      carry += ordered[eventIndex].delta;
      eventIndex += 1;
    }
    values.push(roundNoteMoney(Math.max(0, carry), 2));
  }
  if (values.length > 0) {
    values[values.length - 1] = roundNoteMoney(liveConfirmed, 2);
  }
  return values;
}

export function principalEventsFromConfirmationsAndReturns(input: {
  confirmations: readonly { confirmedAt: Date | null | undefined; amount: number }[];
  principalReturns: readonly { postedAt: Date; principal: number }[];
}): PrincipalEvent[] {
  const events: PrincipalEvent[] = [];
  for (const row of input.confirmations) {
    if (!row.confirmedAt || row.amount <= 0) continue;
    events.push({ dateKey: malaysiaDateKey(row.confirmedAt), delta: row.amount });
  }
  for (const row of input.principalReturns) {
    if (row.principal <= 0) continue;
    events.push({ dateKey: malaysiaDateKey(row.postedAt), delta: -row.principal });
  }
  return events;
}

export type HoldingForDashboard = {
  investmentId: string;
  noteId: string;
  noteReference: string;
  issuerName: string | null;
  noteStatus: string;
  servicingStatus: string;
  daysPastDue: number;
  confirmedAmount: number;
  fundedAmount: number;
  recoveredPrincipal: number;
  recoveredProfit: number;
  profitRatePercent: number;
  serviceFeeRatePercent: number;
  tenureDays: number | null;
  disbursementValueDate?: Date | null;
  activatedAt?: Date | null;
  maturityDate?: Date | null;
  paymentSchedules?: Array<{ due_date: Date | null; sequence?: number | null }>;
};

function isClosedHolding(holding: HoldingForDashboard): boolean {
  return (
    CLOSED_NOTE_STATUS.has(holding.noteStatus) || holding.servicingStatus === "SETTLED"
  );
}

function isAtRiskHolding(holding: HoldingForDashboard): boolean {
  return (
    AT_RISK_SERVICING.has(holding.servicingStatus) || AT_RISK_NOTE_STATUS.has(holding.noteStatus)
  );
}

function holdingOutstanding(holding: HoldingForDashboard) {
  return noteOutstandingAmounts({
    fundedAmount: holding.fundedAmount,
    recoveredPrincipal: holding.recoveredPrincipal,
    recoveredProfit: holding.recoveredProfit,
    profitRatePercent: holding.profitRatePercent,
    tenureDays: tenureDaysForNote({
      tenure_days: holding.tenureDays,
      disbursement_value_date: holding.disbursementValueDate,
      activated_at: holding.activatedAt,
      maturity_date: holding.maturityDate,
    }),
  });
}

function investorShareOf(holding: HoldingForDashboard, noteAmount: number): number {
  if (holding.fundedAmount <= 0) return 0;
  return roundNoteMoney(noteAmount * (holding.confirmedAmount / holding.fundedAmount), 2);
}

function holdingExpectedPayout(holding: HoldingForDashboard): { amount: number; profit: number } {
  const outstanding = holdingOutstanding(holding);
  if (outstanding.outstandingTotal <= 0 || holding.fundedAmount <= 0) {
    return { amount: roundNoteMoney(holding.confirmedAmount, 2), profit: 0 };
  }
  const principal = investorShareOf(holding, outstanding.outstandingPrincipal);
  const grossProfit = investorShareOf(holding, outstanding.outstandingProfit);
  const feeRate = Math.max(0, holding.serviceFeeRatePercent);
  const profit = roundNoteMoney(grossProfit * (1 - feeRate / 100), 2);
  return { amount: roundNoteMoney(principal + profit, 2), profit };
}

export function computeAtRisk(
  holdings: readonly HoldingForDashboard[],
  portfolioTotal: number
): InvestorPortfolioAtRisk {
  const atRisk = holdings.filter(
    (holding) => !isClosedHolding(holding) && holding.confirmedAmount > 0 && isAtRiskHolding(holding)
  );
  const amount = roundNoteMoney(
    atRisk.reduce((sum, holding) => {
      const outstanding = holdingOutstanding(holding);
      const remaining =
        outstanding.outstandingTotal > 0 && holding.fundedAmount > 0
          ? investorShareOf(holding, outstanding.outstandingTotal)
          : roundNoteMoney(holding.confirmedAmount, 2);
      return sum + remaining;
    }, 0),
    2
  );
  let maxDaysPastDue: number | null = null;
  for (const holding of atRisk) {
    if (holding.daysPastDue <= 0) continue;
    maxDaysPastDue =
      maxDaysPastDue == null ? holding.daysPastDue : Math.max(maxDaysPastDue, holding.daysPastDue);
  }
  return {
    amount,
    percent: portfolioTotal > 0 ? roundNoteMoney((amount / portfolioTotal) * 100, 2) : 0,
    count: atRisk.length,
    maxDaysPastDue,
  };
}

function holdingDueDate(holding: HoldingForDashboard): Date | null {
  return resolveServicingDueDate({
    maturity_date: holding.maturityDate,
    payment_schedules: holding.paymentSchedules,
  });
}

export function computeCashflowNext90Days(
  holdings: readonly HoldingForDashboard[],
  now: Date
): InvestorCashflowNext90Days {
  const horizon = mytStartOfDayUtc(addMytCalendarDays(mytCalendarParts(now), 90));
  const months = mytYearMonthsThrough(now, horizon).map((yearMonth) => ({
    yearMonth,
    label: formatYearMonthLabel(yearMonth),
    amount: 0,
    count: 0,
  }));
  const monthIndex = new Map(months.map((month, index) => [month.yearMonth, index]));
  const live = holdings.filter(
    (holding) => !isClosedHolding(holding) && holding.confirmedAmount > 0
  );
  const upcomingRows: InvestorCashflowNext90Days["upcoming"] = [];

  for (const holding of live) {
    const due = holdingDueDate(holding);
    if (!due) continue;
    const daysRemaining = malaysiaCalendarDaysRemaining(now, due);
    if (daysRemaining == null || daysRemaining < 0 || daysRemaining > 90) continue;
    const dueKey = malaysiaDateKey(due);
    const yearMonth = dueKey.slice(0, 7);
    const { amount, profit } = holdingExpectedPayout(holding);
    const month = monthIndex.has(yearMonth) ? months[monthIndex.get(yearMonth)!] : null;
    if (month) {
      month.amount = roundNoteMoney(month.amount + amount, 2);
      month.count += 1;
    }
    upcomingRows.push({
      investmentId: holding.investmentId,
      noteId: holding.noteId,
      noteReference: holding.noteReference,
      issuerName: holding.issuerName,
      dueDate: dueKey,
      amount,
      profit,
      tenureDays: holding.tenureDays,
    });
  }

  upcomingRows.sort((left, right) => {
    if (left.dueDate !== right.dueDate) return left.dueDate.localeCompare(right.dueDate);
    if (left.noteReference !== right.noteReference) {
      return left.noteReference.localeCompare(right.noteReference);
    }
    if (left.amount !== right.amount) return left.amount - right.amount;
    return left.investmentId.localeCompare(right.investmentId);
  });

  return {
    totalAmount: roundNoteMoney(
      months.reduce((sum, month) => sum + month.amount, 0),
      2
    ),
    noteCount: upcomingRows.length,
    months,
    upcoming: upcomingRows.slice(0, 5),
  };
}

export function snapshotName(snapshot: unknown, keys: readonly string[]): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const record = snapshot as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
