import {
  CASHSOUK_TIMEZONE,
  calendarDateKey,
  formatCalendarDate,
  malaysiaDateTimeLocalToIso,
  parseCalendarDate,
  parseMalaysiaDateTimeLocal,
  toCalendarDateInput,
  toMalaysiaDateTimeLocalInput,
} from "./calendar-date";

describe("calendar dates (Asia/Kuala_Lumpur)", () => {
  it("uses Malaysia as the business timezone", () => {
    expect(CASHSOUK_TIMEZONE).toBe("Asia/Kuala_Lumpur");
  });

  it("keeps a date-only YYYY-MM-DD without constructing a local Date", () => {
    expect(calendarDateKey("1989-11-14")).toBe("1989-11-14");
    expect(formatCalendarDate("1989-11-14")).toBe("14 Nov 1989");
    expect(toCalendarDateInput("1989-11-14")).toBe("1989-11-14");
  });

  it("maps UTC midnight of the civil day to the same Malaysia day", () => {
    expect(calendarDateKey("1989-11-14T00:00:00.000Z")).toBe("1989-11-14");
    expect(formatCalendarDate("1989-11-14T00:00:00.000Z")).toBe("14 Nov 1989");
    expect(toCalendarDateInput("1989-11-14T00:00:00.000Z")).toBe("1989-11-14");
  });

  it("maps Malaysia midnight stored as the previous UTC evening to 14 Nov 1989", () => {
    expect(calendarDateKey("1989-11-13T16:00:00.000Z")).toBe("1989-11-14");
    expect(formatCalendarDate("1989-11-13T16:00:00.000Z")).toBe("14 Nov 1989");
    expect(toCalendarDateInput("1989-11-13T16:00:00.000Z")).toBe("1989-11-14");
    expect(parseCalendarDate("1989-11-13T16:00:00.000Z")?.toISOString()).toBe(
      "1989-11-14T00:00:00.000Z"
    );
  });

  it("keeps 15 Dec as the Malaysia civil day (not the previous UTC evening)", () => {
    expect(formatCalendarDate("2026-12-15")).toBe("15 Dec 2026");
    expect(formatCalendarDate("2026-12-15T00:00:00.000Z")).toBe("15 Dec 2026");
    expect(formatCalendarDate("2026-12-14T16:00:00.000Z")).toBe("15 Dec 2026");
  });

  it("does not shift a UTC-midnight Date when formatted in a western timezone", () => {
    const utcMidnight = new Date("1989-11-14T00:00:00.000Z");
    expect(calendarDateKey(utcMidnight)).toBe("1989-11-14");
    expect(formatCalendarDate(utcMidnight)).toBe("14 Nov 1989");
  });

  it("parses CTOS DD-MM-YYYY as day-month, not US month-day", () => {
    expect(calendarDateKey("14-11-1989")).toBe("1989-11-14");
    expect(calendarDateKey("01-12-2001")).toBe("2001-12-01");
    expect(formatCalendarDate("01-12-2001")).toBe("1 Dec 2001");
  });

  it("rejects invalid civil days", () => {
    expect(calendarDateKey("1989-02-31")).toBeNull();
    expect(calendarDateKey("not-a-date")).toBeNull();
    expect(calendarDateKey("")).toBeNull();
    expect(calendarDateKey(null)).toBeNull();
    expect(toCalendarDateInput(undefined)).toBe("");
    expect(formatCalendarDate(null)).toBe("");
  });

  it("normalizes persist writes to UTC midnight of the Malaysia civil day", () => {
    expect(parseCalendarDate("1989-11-14")?.toISOString()).toBe("1989-11-14T00:00:00.000Z");
    expect(parseCalendarDate("14/11/1989")?.toISOString()).toBe("1989-11-14T00:00:00.000Z");
  });
});

describe("Malaysia datetime-local (Asia/Kuala_Lumpur)", () => {
  it("converts KL wall time to UTC ISO", () => {
    expect(malaysiaDateTimeLocalToIso("2026-09-22T16:30")).toBe("2026-09-22T08:30:00.000Z");
    expect(parseMalaysiaDateTimeLocal("2026-09-22T00:00")?.toISOString()).toBe(
      "2026-09-21T16:00:00.000Z"
    );
  });

  it("round-trips an instant through the datetime-local input value", () => {
    const iso = "2026-09-22T08:30:00.000Z";
    expect(toMalaysiaDateTimeLocalInput(iso)).toBe("2026-09-22T16:30");
    expect(malaysiaDateTimeLocalToIso(toMalaysiaDateTimeLocalInput(iso))).toBe(iso);
  });

  it("rejects invalid civil days and clock values", () => {
    expect(parseMalaysiaDateTimeLocal("2026-02-31T10:00")).toBeNull();
    expect(parseMalaysiaDateTimeLocal("2026-09-22T24:00")).toBeNull();
    expect(parseMalaysiaDateTimeLocal("not-a-datetime")).toBeNull();
    expect(malaysiaDateTimeLocalToIso("")).toBeNull();
    expect(toMalaysiaDateTimeLocalInput(null)).toBe("");
  });
});
