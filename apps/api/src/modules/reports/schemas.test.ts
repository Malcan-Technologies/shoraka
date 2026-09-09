import { AppError } from "../../lib/http/error-handler";
import { inclusiveRangePostedAtFilter } from "@cashsouk/types";
import { reportQuerySchema } from "./schemas";
import { assertReportQuery, openBookSnapshots } from "./report-shared";

describe("report query schema", () => {
  it("requires from and to together and rejects inverted ranges", () => {
    expect(reportQuerySchema.safeParse({ from: "2026-09-01" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ from: "2026-09-09", to: "2026-09-01" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ from: "2026-09-01", to: "2026-09-09" }).success).toBe(true);
    expect(reportQuerySchema.safeParse({ from: "2026-02-30", to: "2026-02-30" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ asOf: "2026-99-01" }).success).toBe(false);
  });

  it("accepts only the four composition breakdowns", () => {
    expect(reportQuerySchema.safeParse({ groupBy: "issuer" }).success).toBe(true);
    expect(reportQuerySchema.safeParse({ groupBy: "vintage" }).success).toBe(false);
  });
});

describe("assertReportQuery", () => {
  it("rejects groupBy on reports other than portfolio composition", () => {
    expect(() => assertReportQuery("ageing", { groupBy: "issuer" })).toThrow(AppError);
    expect(() => assertReportQuery("portfolio_composition", { groupBy: "issuer" })).not.toThrow();
  });
});

describe("openBookSnapshots", () => {
  it("drops SETTLED snapshots so historical ageing and composition match live open-book queries", () => {
    expect(
      openBookSnapshots([
        { servicing_status: "CURRENT", outstanding: 100 },
        { servicing_status: "SETTLED", outstanding: 0 },
        { servicing_status: "ARREARS", outstanding: 40 },
      ])
    ).toEqual([
      { servicing_status: "CURRENT", outstanding: 100 },
      { servicing_status: "ARREARS", outstanding: 40 },
    ]);
  });
});

describe("late fees MYT range", () => {
  it("includes 00:00-07:59 MYT on the from day", () => {
    const range = inclusiveRangePostedAtFilter("2026-09-09", "2026-09-09");
    expect(range?.gte.toISOString()).toBe("2026-09-08T16:00:00.000Z");
    expect(range?.lt.toISOString()).toBe("2026-09-09T16:00:00.000Z");
    const earlyMyt = new Date("2026-09-08T16:30:00.000Z");
    expect(earlyMyt >= range!.gte && earlyMyt < range!.lt).toBe(true);
    const utcMidnightSameLabel = new Date("2026-09-09T00:00:00.000Z");
    expect(utcMidnightSameLabel >= range!.gte && utcMidnightSameLabel < range!.lt).toBe(true);
  });
});
