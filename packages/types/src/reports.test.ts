import {
  groupReportsByCategory,
  isReportBreakdown,
  isReportCategoryKey,
  isReportKey,
  par90LimitStatus,
  REPORT_CATEGORIES,
  REPORT_KEYS,
  REPORT_REGISTRY,
  SC_PAR90_LIMIT_PERCENT,
} from "./reports";

describe("report registry", () => {
  it("groups reports in category order without leftover keys", () => {
    const groups = groupReportsByCategory();
    expect(groups.map((group) => group.key)).toEqual(REPORT_CATEGORIES.map((item) => item.key));
    expect(groups.flatMap((group) => group.reports.map((report) => report.key))).toEqual(
      REPORT_REGISTRY.map((report) => report.key)
    );
    expect(REPORT_REGISTRY.map((report) => report.key)).toEqual([...REPORT_KEYS]);
  });

  it("places existing credit extracts and ComRep in the locked categories", () => {
    const groups = groupReportsByCategory();
    expect(groups[0]?.reports.map((report) => report.key)).toEqual([
      "ageing",
      "npl",
      "late_fees",
      "default_recovery",
    ]);
    expect(groups[1]?.reports.map((report) => report.key)).toEqual([
      "origination",
      "portfolio_composition",
    ]);
    expect(groups[3]?.reports.map((report) => report.key)).toEqual(["comrep"]);
    expect(REPORT_REGISTRY.find((report) => report.key === "comrep")?.available).toBe(false);
  });

  it("exposes portfolio composition breakdown options", () => {
    const report = REPORT_REGISTRY.find((item) => item.key === "portfolio_composition");
    expect(report?.breakdownOptions).toEqual(["start_month", "issuer", "paymaster", "sector"]);
    expect(isReportBreakdown("issuer")).toBe(true);
    expect(isReportBreakdown("vintage")).toBe(false);
  });

  it("narrows keys and categories", () => {
    expect(isReportKey("investor_book")).toBe(true);
    expect(isReportKey("book_mix")).toBe(false);
    expect(isReportCategoryKey("credit_quality")).toBe(true);
    expect(isReportCategoryKey("book")).toBe(false);
  });
});

describe("SC PAR90 limit", () => {
  it("caps indicative PAR90 at 5 percent of book", () => {
    expect(SC_PAR90_LIMIT_PERCENT).toBe(5);
    expect(par90LimitStatus(0)).toBe("inside");
    expect(par90LimitStatus(SC_PAR90_LIMIT_PERCENT)).toBe("inside");
    expect(par90LimitStatus(SC_PAR90_LIMIT_PERCENT + 0.01)).toBe("over");
  });
});
