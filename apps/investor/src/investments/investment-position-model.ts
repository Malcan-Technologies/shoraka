import { formatCurrency } from "@cashsouk/config";
import {
  formatInvestorReturnRatePercent,
  formatNoteReferenceDisplay,
  isSettlementWrappingUpFromSummary,
  resolveNetExpectedReturnRatePercent,
  type NoteListItem,
} from "@cashsouk/types";

export const MATURING_SOON_DAYS = 7;

export type InvestmentMaturityTone = "upcoming" | "soon" | "today" | "overdue" | "settled" | "unknown";

export type InvestmentMaturityDisplay = {
  tone: InvestmentMaturityTone;
  value: string;
  unit: string | null;
  date: string;
};

export function calendarDaysFromToday(
  iso: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function formatInvestmentDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  now: Date = new Date()
): number {
  const leftDays = calendarDaysFromToday(left.maturityDate, now) ?? Number.POSITIVE_INFINITY;
  const rightDays = calendarDaysFromToday(right.maturityDate, now) ?? Number.POSITIVE_INFINITY;
  return leftDays - rightDays;
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
  const received = Number(summary?.receivedPayoutAmount ?? 0);
  const profit = Number(summary?.receivedProfitNetAmount ?? Math.max(0, received - invested));
  const tawidh = Number(summary?.receivedTawidhCompensationAmount ?? 0);
  const actualReturn =
    typeof summary?.actualReturnRatePercent === "number" ? summary.actualReturnRatePercent : null;
  return {
    invested,
    expectedReturn,
    received,
    profit,
    tawidh,
    actualReturn,
    daysToMaturity: calendarDaysFromToday(note.maturityDate, now),
    issuerName: note.issuerName?.trim() || "Issuer",
    noteLabel: formatNoteReferenceDisplay(note.noteReference) || note.title,
  };
}

export function getInvestmentMaturityDisplay(
  note: NoteListItem,
  now: Date = new Date()
): InvestmentMaturityDisplay {
  const date = formatInvestmentDate(note.maturityDate);
  if (isInvestorInvestmentCompleted(note)) {
    return { tone: "settled", value: date, unit: "Matured", date: "" };
  }
  const days = calendarDaysFromToday(note.maturityDate, now);
  if (days == null) {
    return { tone: "unknown", value: "—", unit: "Maturity", date: "" };
  }
  if (days === 0) {
    return { tone: "today", value: "Today", unit: "Matures", date };
  }
  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      tone: "overdue",
      value: String(overdue),
      unit: overdue === 1 ? "day past due" : "days past due",
      date,
    };
  }
  return {
    tone: days <= MATURING_SOON_DAYS ? "soon" : "upcoming",
    value: String(days),
    unit: days === 1 ? "day left" : "days left",
    date,
  };
}

export function investmentCardHeadline(note: NoteListItem): string {
  const facts = getInvestmentPositionFacts(note);
  const completed = isInvestorInvestmentCompleted(note);
  const rate =
    completed && facts.actualReturn != null
      ? `${formatInvestorReturnRatePercent(facts.actualReturn)} actual`
      : `${formatInvestorReturnRatePercent(facts.expectedReturn)} p.a.`;
  return `${formatCurrency(facts.invested)} invested · ${rate}`;
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
  const profitDays = note.investorRepaymentSummary?.profitDays;
  if (facts.received <= 0.005 || facts.invested <= 0.005) return null;
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
