import {
  addUtcCalendarDays,
  isTenureBackedNote,
  malaysiaTodayYmd,
  parseMalaysiaYmdToUtcMidnight,
  validateDisbursementValueDate,
} from "./disbursement-value-date";

describe("parseMalaysiaYmdToUtcMidnight", () => {
  it("stores the selected calendar date as UTC midnight without host timezone shift", () => {
    const parsed = parseMalaysiaYmdToUtcMidnight("2026-08-20");
    expect(parsed?.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(parsed?.getUTCFullYear()).toBe(2026);
    expect(parsed?.getUTCMonth()).toBe(7);
    expect(parsed?.getUTCDate()).toBe(20);
  });

  it("rejects non yyyy-MM-dd values and impossible dates", () => {
    expect(parseMalaysiaYmdToUtcMidnight("20/08/2026")).toBeNull();
    expect(parseMalaysiaYmdToUtcMidnight("2026-02-31")).toBeNull();
    expect(parseMalaysiaYmdToUtcMidnight("2026-13-01")).toBeNull();
    expect(parseMalaysiaYmdToUtcMidnight("")).toBeNull();
  });
});

describe("malaysiaTodayYmd around the MY date boundary", () => {
  it("rolls to 24 Aug at MYT midnight (16:00 UTC the previous day)", () => {
    expect(malaysiaTodayYmd(new Date("2026-08-23T16:00:00.000Z"))).toBe("2026-08-24");
    expect(malaysiaTodayYmd(new Date("2026-08-23T15:59:59.000Z"))).toBe("2026-08-23");
  });
});

describe("validateDisbursementValueDate", () => {
  const now = new Date("2026-08-23T16:00:00.000Z");

  it("accepts today in Malaysia and past dates as UTC midnight", () => {
    expect(validateDisbursementValueDate("2026-08-24", now)).toEqual({
      ok: true,
      ymd: "2026-08-24",
      date: new Date("2026-08-24T00:00:00.000Z"),
    });
    expect(validateDisbursementValueDate("2026-08-20", now)).toMatchObject({
      ok: true,
      ymd: "2026-08-20",
    });
  });

  it("rejects missing, malformed, impossible, and future dates", () => {
    expect(validateDisbursementValueDate("", now).ok).toBe(false);
    expect(validateDisbursementValueDate(undefined, now)).toEqual({
      ok: false,
      message: "Actual disbursement date is required.",
    });
    expect(validateDisbursementValueDate("2026-02-31", now).message).toMatch(
      /not a valid calendar date/
    );
    expect(validateDisbursementValueDate("2026-08-25", now).message).toMatch(
      /cannot be in the future/
    );
    expect(validateDisbursementValueDate("24/08/2026", now).message).toMatch(/yyyy-MM-dd/);
  });
});

describe("addUtcCalendarDays maturity examples", () => {
  it("adds 90 calendar days from 20 Aug 2026 to 18 Nov 2026", () => {
    const start = parseMalaysiaYmdToUtcMidnight("2026-08-20");
    expect(start).not.toBeNull();
    expect(addUtcCalendarDays(start!, 90).toISOString()).toBe("2026-11-18T00:00:00.000Z");
  });

  it("crosses leap day and year boundaries", () => {
    const feb28 = parseMalaysiaYmdToUtcMidnight("2024-02-28")!;
    expect(addUtcCalendarDays(feb28, 1).toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(addUtcCalendarDays(feb28, 2).toISOString()).toBe("2024-03-01T00:00:00.000Z");

    const dec31 = parseMalaysiaYmdToUtcMidnight("2026-12-31")!;
    expect(addUtcCalendarDays(dec31, 1).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("isTenureBackedNote", () => {
  it("treats a positive integer tenure as the new engine", () => {
    expect(isTenureBackedNote(90)).toBe(true);
    expect(isTenureBackedNote(null)).toBe(false);
    expect(isTenureBackedNote(undefined)).toBe(false);
    expect(isTenureBackedNote(0)).toBe(false);
  });
});
