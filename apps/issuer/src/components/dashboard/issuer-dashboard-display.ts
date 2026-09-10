export { formatMytDateTime } from "@cashsouk/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function calendarMonthDay(dueDate: string): { month: string; day: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate.trim());
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return null;
  return { month: month.toUpperCase(), day: String(Number(match[3])) };
}

export function chartMonthLabel(date: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(dueDateOrMonth(date));
  if (!match) return date;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return date;
  return `${month} ${match[1].slice(2)}`;
}

function dueDateOrMonth(date: string): string {
  return date.trim();
}

export function formatCompactThousands(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = amount / 1_000_000;
    const label = Number.isInteger(millions) ? String(millions) : millions.toFixed(1).replace(/\.0$/, "");
    return `${label}m`;
  }
  if (abs >= 1000) return `${Math.round(amount / 1000)}k`;
  return String(Math.round(amount));
}

export function monthShortFromYearMonth(yearMonth: string, fallbackLabel: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(yearMonth);
  if (!match) return fallbackLabel;
  return MONTHS[Number(match[2]) - 1] ?? fallbackLabel;
}

export function hasFacilityLimit(input: {
  availableLimit: number | null;
  approvedLimit: number | null;
}): boolean {
  return input.availableLimit != null || input.approvedLimit != null;
}

export function visibleCostOfFinancingLines(cost: {
  profitOnNotes: number;
  drawdownFees: number;
  facilityFees: number;
  tawidh: number;
}): Array<{ label: string; amount: number }> {
  return [
    { label: "Profit on notes", amount: cost.profitOnNotes },
    { label: "Drawdown fees", amount: cost.drawdownFees },
    { label: "Facility fees", amount: cost.facilityFees },
    { label: "Ta'widh", amount: cost.tawidh },
  ].filter((line) => line.amount > 0.005);
}

export const FUNDING_PROGRESS_PAGE_SIZE = 5;
