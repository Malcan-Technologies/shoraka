import {
  matchStatementPeriodPreset,
  mytTodayKey,
  statementPeriodRange,
} from "./statement-period";

describe("statementPeriodRange", () => {
  const now = new Date("2026-08-19T10:00:00+08:00");

  it("uses the previous calendar month", () => {
    expect(statementPeriodRange("last_month", now)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
  });

  it("uses the first of this month through today", () => {
    expect(statementPeriodRange("this_month", now)).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-19",
    });
  });

  it("uses year to date through today", () => {
    expect(statementPeriodRange("ytd", now)).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-08-19",
    });
  });

  it("uses 90 inclusive days ending today", () => {
    expect(statementPeriodRange("last_90d", now)).toEqual({
      startDate: "2026-05-22",
      endDate: "2026-08-19",
    });
  });

  it("crosses the year for January last-month", () => {
    expect(statementPeriodRange("last_month", new Date("2026-01-05T09:00:00+08:00"))).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });
});

describe("matchStatementPeriodPreset", () => {
  const now = new Date("2026-08-19T10:00:00+08:00");

  it("recognizes a matching chip range", () => {
    expect(matchStatementPeriodPreset("2026-07-01", "2026-07-31", now)).toBe("last_month");
    expect(matchStatementPeriodPreset("2026-01-01", "2026-08-19", now)).toBe("ytd");
  });

  it("returns null for a custom range", () => {
    expect(matchStatementPeriodPreset("2026-02-01", "2026-02-15", now)).toBeNull();
    expect(matchStatementPeriodPreset("", "", now)).toBeNull();
  });
});

describe("mytTodayKey", () => {
  it("formats the Malaysia calendar date", () => {
    expect(mytTodayKey(new Date("2026-08-19T01:00:00+08:00"))).toBe("2026-08-19");
  });
});
