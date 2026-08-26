import { formatCurrency } from "@cashsouk/config";
import {
  compareNoteTimingSort,
  formatInvestorReturnRatePercent,
  formatNoteDateEnMy,
  formatNoteReferenceDisplay,
  joinNoteTimingExtra,
  isSettlementWrappingUpFromSummary,
  isTenureBackedNote,
  malaysiaCalendarDaysRemaining,
  NOTE_TIMING_GRACE_TOOLTIP,
  NOTE_TIMING_PAST_MATURITY_TOOLTIP,
  resolveNoteGracePeriodDays,
  resolveNoteTimingDisplay,
  shouldLabelExpectedReturnAsUpTo,
  resolveNetExpectedReturnRatePercent,
  type NoteListItem,
} from "@cashsouk/types";

export const MATURING_SOON_DAYS = 7;

export type InvestmentMaturityTone =
  | "upcoming"
  | "soon"
  | "today"
  | "grace"
  | "overdue"
  | "settled"
  | "unknown";

export type InvestmentMaturityDisplay = {
  tone: InvestmentMaturityTone;
  value: string;
  unit: string | null;
  date: string;
  tooltip?: string | null;
};

export function calendarDaysFromToday(
  iso: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!iso) return null;
  return malaysiaCalendarDaysRemaining(now, iso);
}

export function formatInvestmentDate(value?: string | null): string {
  return formatNoteDateEnMy(value) ?? "—";
}

function statusOf(note: NoteListItem): string {
  return String(note.status ?? "").toUpperCase();
}

function servicingOf(note: NoteListItem): string {
  return String(note.servicingStatus ?? "").toUpperCase();
}

export function isInvestorSettlementProcessing(note: NoteListItem): boolean {
  return isSettlementWrappingUpFromSummary(note.settlementSummary);
}

export function isInvestorInvestmentCompleted(note: NoteListItem): boolean {
  if (isInvestorSettlementProcessing(note)) return false;
  const status = statusOf(note);
  const servicing = servicingOf(note);
  return (
    status === "CANCELLED" ||
    status === "FAILED_FUNDING" ||
    status === "REPAID" ||
    servicing === "SETTLED"
  );
}

export function getInvestmentRelevanceRank(note: NoteListItem): number {
  return isInvestorInvestmentCompleted(note) ? 1 : 0;
}

export function compareInvestmentMaturity(
  left: NoteListItem,
  right: NoteListItem,
  _now: Date = new Date()
): number {
  return compareNoteTimingSort(left, right);
}

function completedSortTime(note: NoteListItem): number {
  for (const value of [note.maturityDate, note.repaidAt, note.updatedAt]) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isFinite(time)) return time;
  }
  return 0;
}

export function compareCompletedInvestmentLatestFirst(
  left: NoteListItem,
  right: NoteListItem
): number {
  return completedSortTime(right) - completedSortTime(left);
}

export function partitionInvestorInvestments(notes: readonly NoteListItem[]): {
  active: NoteListItem[];
  completed: NoteListItem[];
} {
  const active: NoteListItem[] = [];
  const completed: NoteListItem[] = [];
  for (const note of notes) {
    if (isInvestorInvestmentCompleted(note)) completed.push(note);
    else active.push(note);
  }
  return { active, completed };
}

export function getInvestmentPositionFacts(note: NoteListItem, now: Date = new Date()) {
  const summary = note.investorRepaymentSummary ?? null;
  const invested = Number(summary?.investedPrincipal ?? note.fundedAmount);
  const expectedReturn = Number(
    summary?.expectedReturnRatePercent ?? resolveNetExpectedReturnRatePercent(note) ?? 0
  );
  const expectedProfit = Number(summary?.expectedProfitAmount ?? 0);
  const received = Number(summary?.receivedPayoutAmount ?? 0);
  const profit = Number(summary?.receivedProfitNetAmount ?? Math.max(0, received - invested));
  const tawidh = Number(summary?.receivedTawidhCompensationAmount ?? 0);
  const actualReturn =
    typeof summary?.actualReturnRatePercent === "number" ? summary.actualReturnRatePercent : null;
  const completed = isInvestorInvestmentCompleted(note);
  return {
    invested,
    expectedReturn,
    expectedProfit,
    received,
    profit,
    tawidh,
    actualReturn,
    daysToMaturity: calendarDaysFromToday(note.maturityDate, now),
    expectedReturnIsEstimate: shouldLabelExpectedReturnAsUpTo({
      tenureDays: note.tenureDays,
      settled: completed,
    }),
    noteLabel: formatNoteReferenceDisplay(note.noteReference) || note.title,
  };
}

export function resolveInvestmentSettlementDate(note: NoteListItem): string | null {
  return formatNoteDateEnMy(
    note.settlementSummary?.actualSettlementDate ??
      note.repaidAt ??
      note.settlementSummary?.postedAt
  );
}

export function getInvestmentMaturityDisplay(
  note: NoteListItem,
  now: Date = new Date()
): InvestmentMaturityDisplay {
  const timing = resolveNoteTimingDisplay(note, now);
  const date = timing.kind === "tenure_activated" || timing.kind === "legacy" ? timing.value : "";
  if (isInvestorInvestmentCompleted(note)) {
    return {
      tone: "settled",
      value: resolveInvestmentSettlementDate(note) ?? "—",
      unit: "Settled",
      date: "",
    };
  }
  if (timing.kind === "tenure_pending") {
    return {
      tone: "upcoming",
      value: timing.compactValue,
      unit: timing.compactLabel,
      date: "",
      tooltip: timing.tooltip,
    };
  }
  const days = calendarDaysFromToday(note.maturityDate, now);
  if (days == null) {
    return { tone: "unknown", value: "—", unit: "Maturity date", date: "" };
  }
  if (days === 0) {
    return { tone: "today", value: "Today", unit: "Matures", date };
  }
  if (days < 0) {
    const elapsed = Math.abs(days);
    const graceDays = resolveNoteGracePeriodDays(note);
    if (isTenureBackedNote(note.tenureDays) && elapsed <= graceDays) {
      return {
        tone: "grace",
        value: String(elapsed),
        unit: elapsed === 1 ? "day in grace" : "days in grace",
        date,
        tooltip: NOTE_TIMING_GRACE_TOOLTIP,
      };
    }
    return {
      tone: "overdue",
      value: String(elapsed),
      unit: isTenureBackedNote(note.tenureDays)
        ? elapsed === 1
          ? "day past maturity"
          : "days past maturity"
        : elapsed === 1
          ? "day past due"
          : "days past due",
      date,
      tooltip: isTenureBackedNote(note.tenureDays) ? NOTE_TIMING_PAST_MATURITY_TOOLTIP : null,
    };
  }
  return {
    tone: days <= MATURING_SOON_DAYS ? "soon" : "upcoming",
    value: String(days),
    unit: days === 1 ? "day left" : "days left",
    date,
  };
}

export function investmentMaturityKpiExtra(
  maturity: InvestmentMaturityDisplay,
  timing: ReturnType<typeof resolveNoteTimingDisplay>
): string | undefined {
  return joinNoteTimingExtra(maturity.date, timing.secondary);
}

export { resolveNoteGracePeriodDays };

export type InvestmentReturnDisplay = {
  ratePercent: number;
  label: "p.a. actual" | "Up to" | "p.a.";
  tooltip?: string;
};

export function periodProfitRatePercent(note: NoteListItem): number | null {
  const facts = getInvestmentPositionFacts(note);
  if (facts.invested <= 0.005) return null;
  return ((facts.profit + facts.tawidh) / facts.invested) * 100;
}

export function actualReturnRateTooltip(note: NoteListItem): string {
  const periodLabel = formatInvestorReturnRatePercent(periodProfitRatePercent(note) ?? 0);
  return `p.a. means per annum (annualized). Actual profit on this note was ${periodLabel}.`;
}

export function getInvestmentReturnDisplay(note: NoteListItem): InvestmentReturnDisplay {
  const facts = getInvestmentPositionFacts(note);
  if (isInvestorInvestmentCompleted(note)) {
    return {
      ratePercent: facts.actualReturn ?? 0,
      label: "p.a. actual",
      tooltip: actualReturnRateTooltip(note),
    };
  }
  if (facts.expectedReturnIsEstimate) {
    return { ratePercent: facts.expectedReturn, label: "Up to" };
  }
  return { ratePercent: facts.expectedReturn, label: "p.a." };
}

export function investmentCardHeadline(note: NoteListItem): string {
  const facts = getInvestmentPositionFacts(note);
  const display = getInvestmentReturnDisplay(note);
  if (display.label === "p.a. actual") {
    return `${formatCurrency(facts.invested)} invested · ${formatInvestorReturnRatePercent(display.ratePercent)} p.a. actual`;
  }
  if (display.label === "Up to" && facts.expectedProfit > 0.005) {
    return `${formatCurrency(facts.invested)} invested · Up to ${formatCurrency(facts.expectedProfit)}`;
  }
  return `${formatCurrency(facts.invested)} invested · ${formatInvestorReturnRatePercent(display.ratePercent)} p.a.`;
}

export function investmentCardMeta(note: NoteListItem): string {
  const facts = getInvestmentPositionFacts(note);
  const parts: string[] = [];
  if (facts.received > 0.005) {
    parts.push(`Received ${formatCurrency(facts.received)}`);
  }
  if (facts.tawidh > 0.005) {
    parts.push(`Ta'widh ${formatCurrency(facts.tawidh)}`);
  }
  return parts.join(" · ");
}

export type InvestmentCardPayoutResult = {
  kind: "profit" | "loss";
  amount: number;
};

export function investmentCardPayoutResult(note: NoteListItem): InvestmentCardPayoutResult | null {
  const facts = getInvestmentPositionFacts(note);
  const realized = facts.received > 0.005 || isInvestorInvestmentCompleted(note);
  if (!realized) return null;
  if (facts.profit > 0.005) {
    return { kind: "profit", amount: facts.profit };
  }
  const shortfall = facts.invested - facts.received;
  if (shortfall > 0.005) {
    return { kind: "loss", amount: shortfall };
  }
  return null;
}

export function investmentCardPayoutSignedAmount(note: NoteListItem): number {
  const result = investmentCardPayoutResult(note);
  if (!result) return 0;
  return result.kind === "profit" ? result.amount : -result.amount;
}

export function sumInvestmentPayoutNet(notes: readonly NoteListItem[]): number {
  return notes.reduce((sum, note) => sum + investmentCardPayoutSignedAmount(note), 0);
}

export function portfolioPayoutResult(notes: readonly NoteListItem[]): {
  kind: "profit" | "loss" | "flat";
  amount: number;
} {
  const net = sumInvestmentPayoutNet(notes);
  if (net > 0.005) return { kind: "profit", amount: net };
  if (net < -0.005) return { kind: "loss", amount: Math.abs(net) };
  return { kind: "flat", amount: 0 };
}

export function realizedAnnualReturnRatePercent(note: NoteListItem): number | null {
  const facts = getInvestmentPositionFacts(note);
  if (facts.received <= 0.005 || facts.invested <= 0.005) return null;
  if (facts.actualReturn != null) return facts.actualReturn;
  const profitDays =
    note.investorRepaymentSummary?.actualProfitDays ?? note.investorRepaymentSummary?.profitDays;
  if (!Number.isFinite(profitDays) || !profitDays || profitDays <= 0) return null;
  const periodReturnPercent = ((facts.received - facts.invested) / facts.invested) * 100;
  return periodReturnPercent * (365 / profitDays);
}

export function averageRealizedAnnualReturnRatePercent(
  notes: readonly NoteListItem[]
): number | null {
  let weighted = 0;
  let weight = 0;
  for (const note of notes) {
    const rate = realizedAnnualReturnRatePercent(note);
    if (rate == null) continue;
    const invested = getInvestmentPositionFacts(note).invested;
    weighted += rate * invested;
    weight += invested;
  }
  if (weight <= 0.005) return null;
  return weighted / weight;
}
