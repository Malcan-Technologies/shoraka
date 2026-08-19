import { addMytCalendarDays, mytCalendarParts, type MytDateParts } from "@cashsouk/types";

export const STATEMENT_PERIOD_PRESETS = [
  { id: "last_month", label: "Last month" },
  { id: "this_month", label: "This month" },
  { id: "last_90d", label: "Last 90 days" },
  { id: "ytd", label: "Year to date" },
] as const;

export type StatementPeriodPreset = (typeof STATEMENT_PERIOD_PRESETS)[number]["id"];

export type StatementPeriodRange = {
  startDate: string;
  endDate: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function mytDateKey(parts: MytDateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function mytTodayKey(now = new Date()): string {
  return mytDateKey(mytCalendarParts(now));
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function statementPeriodRange(
  preset: StatementPeriodPreset,
  now = new Date()
): StatementPeriodRange {
  const today = mytCalendarParts(now);
  const todayKey = mytDateKey(today);

  if (preset === "this_month") {
    return { startDate: `${today.year}-${pad(today.month)}-01`, endDate: todayKey };
  }

  if (preset === "last_month") {
    const year = today.month === 1 ? today.year - 1 : today.year;
    const month = today.month === 1 ? 12 : today.month - 1;
    return {
      startDate: `${year}-${pad(month)}-01`,
      endDate: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`,
    };
  }

  if (preset === "ytd") {
    return { startDate: `${today.year}-01-01`, endDate: todayKey };
  }

  return {
    startDate: mytDateKey(addMytCalendarDays(today, -89)),
    endDate: todayKey,
  };
}

export function matchStatementPeriodPreset(
  startDate: string,
  endDate: string,
  now = new Date()
): StatementPeriodPreset | null {
  if (!startDate || !endDate) return null;
  for (const preset of STATEMENT_PERIOD_PRESETS) {
    const range = statementPeriodRange(preset.id, now);
    if (range.startDate === startDate && range.endDate === endDate) return preset.id;
  }
  return null;
}
