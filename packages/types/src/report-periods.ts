import {
  addMytCalendarDays,
  mytCalendarParts,
  mytStartOfDayUtc,
  type MytDateParts,
} from "./deadline-config";

export const REPORT_RANGE_PRESETS = [
  "this_month",
  "last_month",
  "this_quarter",
  "ytd",
  "last_12_months",
  "custom",
] as const;

export type ReportRangePreset = (typeof REPORT_RANGE_PRESETS)[number];

export const REPORT_AS_OF_PRESETS = [
  "today",
  "end_of_last_month",
  "end_of_last_quarter",
  "end_of_last_year",
  "custom",
] as const;

export type ReportAsOfPreset = (typeof REPORT_AS_OF_PRESETS)[number];

export const REPORT_RANGE_PRESET_LABELS: Record<ReportRangePreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  ytd: "Year to date",
  last_12_months: "Last 12 months",
  custom: "Custom",
};

export const REPORT_AS_OF_PRESET_LABELS: Record<ReportAsOfPreset, string> = {
  today: "Today",
  end_of_last_month: "End of last month",
  end_of_last_quarter: "End of last quarter",
  end_of_last_year: "End of last year",
  custom: "Custom",
};

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatMytYmd(parts: MytDateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function parseMytYmd(value: string): MytDateParts | null {
  const match = YMD.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > lastDayOfMonth(year, month)) return null;
  return { year, month, day };
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function todayMytYmd(now = new Date()): string {
  return formatMytYmd(mytCalendarParts(now));
}

function previousMonth(parts: MytDateParts): MytDateParts {
  if (parts.month === 1) return { year: parts.year - 1, month: 12, day: 1 };
  return { year: parts.year, month: parts.month - 1, day: 1 };
}

function quarterStartMonth(month: number): 1 | 4 | 7 | 10 {
  if (month <= 3) return 1;
  if (month <= 6) return 4;
  if (month <= 9) return 7;
  return 10;
}

function endOfPreviousQuarter(parts: MytDateParts): MytDateParts {
  const start = quarterStartMonth(parts.month);
  if (start === 1) return { year: parts.year - 1, month: 12, day: 31 };
  const month = (start - 1) as 3 | 6 | 9;
  return { year: parts.year, month, day: lastDayOfMonth(parts.year, month) };
}

function sameDayPreviousYear(parts: MytDateParts): MytDateParts {
  const year = parts.year - 1;
  return {
    year,
    month: parts.month,
    day: Math.min(parts.day, lastDayOfMonth(year, parts.month)),
  };
}

export function resolveReportRangePreset(
  preset: Exclude<ReportRangePreset, "custom">,
  now = new Date()
): { from: string; to: string } {
  const today = mytCalendarParts(now);
  const todayKey = formatMytYmd(today);

  if (preset === "this_month") {
    return { from: `${today.year}-${pad(today.month)}-01`, to: todayKey };
  }

  if (preset === "last_month") {
    const previous = previousMonth(today);
    return {
      from: `${previous.year}-${pad(previous.month)}-01`,
      to: `${previous.year}-${pad(previous.month)}-${pad(lastDayOfMonth(previous.year, previous.month))}`,
    };
  }

  if (preset === "this_quarter") {
    const startMonth = quarterStartMonth(today.month);
    return { from: `${today.year}-${pad(startMonth)}-01`, to: todayKey };
  }

  if (preset === "ytd") {
    return { from: `${today.year}-01-01`, to: todayKey };
  }

  const start = addMytCalendarDays(sameDayPreviousYear(today), 1);
  return { from: formatMytYmd(start), to: todayKey };
}

export function resolveReportAsOfPreset(
  preset: Exclude<ReportAsOfPreset, "custom">,
  now = new Date()
): string {
  const today = mytCalendarParts(now);
  if (preset === "today") return formatMytYmd(today);
  if (preset === "end_of_last_month") {
    const previous = previousMonth(today);
    return `${previous.year}-${pad(previous.month)}-${pad(lastDayOfMonth(previous.year, previous.month))}`;
  }
  if (preset === "end_of_last_quarter") return formatMytYmd(endOfPreviousQuarter(today));
  return `${today.year - 1}-12-31`;
}

export function matchReportRangePreset(
  from: string,
  to: string,
  now = new Date()
): ReportRangePreset | null {
  if (!from || !to) return null;
  for (const preset of REPORT_RANGE_PRESETS) {
    if (preset === "custom") continue;
    const range = resolveReportRangePreset(preset, now);
    if (range.from === from && range.to === to) return preset;
  }
  return "custom";
}

export function matchReportAsOfPreset(asOf: string, now = new Date()): ReportAsOfPreset | null {
  if (!asOf) return null;
  for (const preset of REPORT_AS_OF_PRESETS) {
    if (preset === "custom") continue;
    if (resolveReportAsOfPreset(preset, now) === asOf) return preset;
  }
  return "custom";
}

export function formatReportDateLabel(ymd: string): string {
  const parts = parseMytYmd(ymd);
  if (!parts) return ymd;
  return `${pad(parts.day)} ${MONTH_LABELS[parts.month - 1] ?? "???"} ${parts.year}`;
}

export function formatReportRangeChip(from: string, to: string, now = new Date()): string {
  const preset = matchReportRangePreset(from, to, now);
  if (preset && preset !== "custom") return REPORT_RANGE_PRESET_LABELS[preset];
  return `Custom: ${formatReportDateLabel(from)} – ${formatReportDateLabel(to)}`;
}

export function formatReportAsOfChip(asOf: string, now = new Date()): string {
  const preset = matchReportAsOfPreset(asOf, now);
  if (preset && preset !== "custom") return REPORT_AS_OF_PRESET_LABELS[preset];
  return `Custom: ${formatReportDateLabel(asOf)}`;
}

export function mytInclusiveRangeToUtc(
  fromYmd: string,
  toYmd: string
): { gte: Date; lt: Date } | null {
  const from = parseMytYmd(fromYmd);
  const to = parseMytYmd(toYmd);
  if (!from || !to) return null;
  return {
    gte: mytStartOfDayUtc(from),
    lt: mytStartOfDayUtc(addMytCalendarDays(to, 1)),
  };
}

export function inclusiveRangePostedAtFilter(fromYmd?: string, toYmd?: string) {
  if (!fromYmd && !toYmd) return undefined;
  if (!fromYmd || !toYmd) return undefined;
  const range = mytInclusiveRangeToUtc(fromYmd, toYmd);
  if (!range) return undefined;
  return { gte: range.gte, lt: range.lt };
}
