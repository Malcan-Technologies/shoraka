import { Prisma } from "@prisma/client";
import { roundNoteMoney } from "@cashsouk/types";
import {
  noteOutstandingAmounts,
  resolveServicingDueDate,
  tenureDaysForNote,
} from "../notes/servicing-classifier";

type Numeric = Prisma.Decimal | number | string | null | undefined;

export type BookMetricNote = {
  funded_amount: Numeric;
  profit_rate_percent: Numeric;
  tenure_days: number | null;
  disbursement_value_date: Date | null;
  activated_at: Date | null;
  maturity_date: Date | null;
  payment_schedules: Array<{ due_date: Date | null; sequence: number | null }>;
  settlements: Array<{
    investor_principal: Numeric;
    investor_profit_gross: Numeric;
  }>;
};

function toNumber(value: Numeric): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function bookMetricOutstandingAmount(note: BookMetricNote): number {
  return noteOutstandingAmounts({
    fundedAmount: toNumber(note.funded_amount),
    recoveredPrincipal: note.settlements.reduce(
      (sum, settlement) => sum + toNumber(settlement.investor_principal),
      0
    ),
    recoveredProfit: note.settlements.reduce(
      (sum, settlement) => sum + toNumber(settlement.investor_profit_gross),
      0
    ),
    profitRatePercent: toNumber(note.profit_rate_percent),
    tenureDays: tenureDaysForNote(note),
  }).outstandingTotal;
}

export function aggregateBookMetricNotes(notes: BookMetricNote[]) {
  return {
    amount: roundNoteMoney(
      notes.reduce((sum, note) => sum + bookMetricOutstandingAmount(note), 0)
    ),
    count: notes.length,
  };
}

export function aggregateDueSoonBookMetric(
  notes: BookMetricNote[],
  start: Date,
  end: Date
) {
  return aggregateBookMetricNotes(
    notes.filter((note) => {
      const dueDate = resolveServicingDueDate(note);
      return dueDate != null && dueDate >= start && dueDate < end;
    })
  );
}
