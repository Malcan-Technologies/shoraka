import { CASHSOUK_TIMEZONE, formatCalendarDate } from "@cashsouk/types";

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: CASHSOUK_TIMEZONE,
  weekday: "short",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: CASHSOUK_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((entry) => entry.type === type)?.value ?? "";
}

function dayPeriod(parts: Intl.DateTimeFormatPart[]): string {
  return part(parts, "dayPeriod").replace(/\./g, "").replace(/\s/g, "").toUpperCase();
}

/** Malaysia wall clock for the admin header: `Mon, 21 Sep 2026` / `10:55:32 PM`. */
export function formatAdminHeaderClock(now: Date): { dateLabel: string; timeLabel: string } {
  const weekday = WEEKDAY_FORMATTER.format(now);
  const timeParts = TIME_FORMATTER.formatToParts(now);
  return {
    dateLabel: `${weekday}, ${formatCalendarDate(now)}`,
    timeLabel: `${part(timeParts, "hour")}:${part(timeParts, "minute")}:${part(timeParts, "second")} ${dayPeriod(timeParts)}`,
  };
}
