import {
  formatReportAsOfChip,
  formatReportRangeChip,
  matchReportAsOfPreset,
  matchReportRangePreset,
  mytInclusiveRangeToUtc,
  resolveReportAsOfPreset,
  resolveReportRangePreset,
} from "./report-periods";

function mytNoon(ymd: string) {
  return new Date(`${ymd}T04:00:00.000Z`);
}

describe("report period presets", () => {
  it("resolves this month, last month, QTD, and YTD in Malaysia time", () => {
    const now = mytNoon("2026-09-09");
    expect(resolveReportRangePreset("this_month", now)).toEqual({
      from: "2026-09-01",
      to: "2026-09-09",
    });
    expect(resolveReportRangePreset("last_month", now)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(resolveReportRangePreset("this_quarter", now)).toEqual({
      from: "2026-07-01",
      to: "2026-09-09",
    });
    expect(resolveReportRangePreset("ytd", now)).toEqual({
      from: "2026-01-01",
      to: "2026-09-09",
    });
  });

  it("uses the previous year for last month and last quarter in January", () => {
    const now = mytNoon("2026-01-05");
    expect(resolveReportRangePreset("last_month", now)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    expect(resolveReportAsOfPreset("end_of_last_month", now)).toBe("2025-12-31");
    expect(resolveReportAsOfPreset("end_of_last_quarter", now)).toBe("2025-12-31");
    expect(resolveReportAsOfPreset("end_of_last_year", now)).toBe("2025-12-31");
  });

  it("rolls last 12 months from the next calendar day one year earlier", () => {
    expect(resolveReportRangePreset("last_12_months", mytNoon("2026-09-09"))).toEqual({
      from: "2025-09-10",
      to: "2026-09-09",
    });
    expect(resolveReportRangePreset("last_12_months", mytNoon("2028-02-29"))).toEqual({
      from: "2027-03-01",
      to: "2028-02-29",
    });
  });

  it("resolves as-of quarter and year ends", () => {
    const now = mytNoon("2026-05-12");
    expect(resolveReportAsOfPreset("today", now)).toBe("2026-05-12");
    expect(resolveReportAsOfPreset("end_of_last_month", now)).toBe("2026-04-30");
    expect(resolveReportAsOfPreset("end_of_last_quarter", now)).toBe("2026-03-31");
    expect(resolveReportAsOfPreset("end_of_last_year", now)).toBe("2025-12-31");
  });

  it("matches presets and labels custom chips", () => {
    const now = mytNoon("2026-09-09");
    expect(matchReportRangePreset("2026-09-01", "2026-09-09", now)).toBe("this_month");
    expect(matchReportRangePreset("2026-01-02", "2026-09-09", now)).toBe("custom");
    expect(formatReportRangeChip("2026-01-02", "2026-09-09", now)).toBe(
      "Custom: 02 Jan 2026 – 09 Sep 2026"
    );
    expect(matchReportAsOfPreset("2026-08-31", now)).toBe("end_of_last_month");
    expect(formatReportAsOfChip("2026-08-15", now)).toBe("Custom: 15 Aug 2026");
  });

  it("converts inclusive MYT dates to a half-open UTC interval", () => {
    const range = mytInclusiveRangeToUtc("2026-09-09", "2026-09-09");
    expect(range?.gte.toISOString()).toBe("2026-09-08T16:00:00.000Z");
    expect(range?.lt.toISOString()).toBe("2026-09-09T16:00:00.000Z");
  });
});
