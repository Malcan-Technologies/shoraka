import {
  malaysiaCalendarDaysRemaining,
  type InvestorCashflowMonth,
  type InvestorPortfolioHistoryPoint,
  type NoteListItem,
} from "@cashsouk/types";
import { isInvestorInvestmentCompleted } from "./investment-position-model";

export function idleDaysCopy(idleDays: number | null | undefined): string | null {
  if (idleDays == null) return null;
  return idleDays === 1 ? "idle 1 day" : `idle ${idleDays} days`;
}

export function atRiskNoteCountCopy(count: number): string {
  return count === 1 ? "1 note at risk" : `${count} notes at risk`;
}

export function dualSeriesChartPaths(
  values: number[],
  width = 600,
  baseline = 176,
  scaleMax?: number
): { line: string; area: string } | null {
  if (values.length < 2) return null;
  const peak = scaleMax && scaleMax > 0 ? scaleMax : Math.max(...values, 1);
  const pts = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = baseline - (Math.max(0, value) / peak) * (baseline - 16);
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  return { line, area: `${line} L${width} ${baseline} L0 ${baseline} Z` };
}

export function portfolioHistoryScaleMax(
  totals: number[],
  principals: number[]
): number {
  const peak = Math.max(0, ...totals, ...principals);
  return peak > 0 ? peak * 1.08 : 1;
}

export function historyAxisLabels(points: readonly InvestorPortfolioHistoryPoint[]): string[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0].date];
  const lastIndex = points.length - 1;
  const indexes = [0];
  if (points.length >= 3) indexes.push(Math.round(lastIndex / 2));
  if (points.length >= 5) {
    indexes.splice(1, 0, Math.round(lastIndex / 4));
    indexes.splice(3, 0, Math.round((lastIndex * 3) / 4));
  }
  indexes.push(lastIndex);
  const unique = [...new Set(indexes)].sort((left, right) => left - right);
  return unique.map((index) => points[index].date);
}

export function cashflowBarPercent(amount: number, maxAmount: number): number {
  if (maxAmount <= 0 || amount <= 0) return 0;
  return Math.max(8, Math.round((amount / maxAmount) * 100));
}

export function tenorProgressPercent(note: NoteListItem, now: Date = new Date()): number | null {
  if (isInvestorInvestmentCompleted(note)) return 100;
  const tenure = note.tenureDays;
  if (tenure == null || tenure <= 0 || !note.maturityDate) return null;
  const remaining = malaysiaCalendarDaysRemaining(now, note.maturityDate);
  if (remaining == null) return null;
  if (remaining <= 0) return 100;
  const elapsed = tenure - remaining;
  return Math.max(0, Math.min(100, Math.round((elapsed / tenure) * 100)));
}

export const HOLDINGS_PREVIEW_LIMIT = 3;

export function marketplaceOpenTotals(notes: readonly { remainingCapacity: number }[], totalCount: number) {
  const seekingFunding = notes.reduce((sum, note) => sum + Math.max(0, note.remainingCapacity), 0);
  const hasFullSet = notes.length >= totalCount;
  return {
    count: totalCount,
    seekingFunding: hasFullSet ? seekingFunding : null,
  };
}

export function monthBucketLabel(label: string): string {
  const [month] = label.split(" ");
  return month || label;
}

export function dueDateChipParts(dueDate: string): { month: string; day: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return null;
  return {
    month: date.toLocaleDateString("en-MY", { month: "short", timeZone: "UTC" }).toUpperCase(),
    day: date.toLocaleDateString("en-MY", { day: "2-digit", timeZone: "UTC" }),
  };
}

export function cashflowMonthMax(months: readonly InvestorCashflowMonth[]): number {
  return months.reduce((max, month) => Math.max(max, month.amount), 0);
}
