import { REPORT_REGISTRY } from "@cashsouk/types";
import {
  defaultReportQuery,
  isDefaultPeriodQuery,
  reportFilterKind,
  reportsCatalogHref,
  reportsTabFromSearch,
  validateCustomAsOf,
  validateCustomRange,
} from "./report-period-filters";

const ageing = REPORT_REGISTRY.find((report) => report.key === "ageing")!;
const lateFees = REPORT_REGISTRY.find((report) => report.key === "late_fees")!;
const composition = REPORT_REGISTRY.find((report) => report.key === "portfolio_composition")!;
const now = new Date("2026-09-09T04:00:00.000Z");

describe("report period filters", () => {
  it("defaults range reports to this month and as-of reports to today", () => {
    expect(defaultReportQuery(lateFees, now)).toEqual({
      from: "2026-09-01",
      to: "2026-09-09",
    });
    expect(defaultReportQuery(ageing, now)).toEqual({ asOf: "2026-09-09" });
    expect(defaultReportQuery(composition, now)).toEqual({
      asOf: "2026-09-09",
      groupBy: "start_month",
    });
  });

  it("validates custom dates with Apply semantics", () => {
    expect(validateCustomRange("2026-09-09", "2026-09-01", "2026-09-09")).toBe(
      "From must be on or before To."
    );
    expect(validateCustomRange("2026-09-01", "", "2026-09-09")).toBe("Choose both From and To.");
    expect(validateCustomRange("2026-09-01", "2026-09-09", "2026-09-09")).toBeNull();
    expect(validateCustomAsOf("2026-09-10", "2026-09-09")).toBe("As of cannot be after today.");
  });

  it("parses catalog tabs and category back links", () => {
    expect(reportsTabFromSearch(null)).toBe("credit_quality");
    expect(reportsTabFromSearch("investors_treasury")).toBe("investors_treasury");
    expect(reportsTabFromSearch("vintage")).toBe("credit_quality");
    expect(reportsCatalogHref("origination")).toBe("/reports?tab=origination");
    expect(reportFilterKind(lateFees)).toBe("range");
    expect(isDefaultPeriodQuery(lateFees, { from: "2026-09-01", to: "2026-09-09" }, now)).toBe(true);
  });
});
