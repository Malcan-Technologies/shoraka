import {
  calendarMonthDay,
  formatCompactThousands,
  FUNDING_PROGRESS_PAGE_SIZE,
  hasFacilityLimit,
  monthShortFromYearMonth,
  visibleCostOfFinancingLines,
} from "./issuer-dashboard-display";

describe("issuer dashboard display", () => {
  it("formats compact thousands without inventing scale", () => {
    expect(formatCompactThousands(186400)).toBe("186k");
    expect(formatCompactThousands(0)).toBe("0");
  });

  it("reads calendar month and day from a MY date key", () => {
    expect(calendarMonthDay("2026-09-18")).toEqual({ month: "SEP", day: "18" });
  });

  it("shortens a year-month for repayment bars", () => {
    expect(monthShortFromYearMonth("2026-10", "Oct 2026")).toBe("Oct");
  });

  it("treats a missing facility as no live limit", () => {
    expect(hasFacilityLimit({ availableLimit: null, approvedLimit: null })).toBe(false);
    expect(hasFacilityLimit({ availableLimit: 760000, approvedLimit: 2000000 })).toBe(true);
  });

  it("pages open notes five at a time on the dashboard", () => {
    expect(FUNDING_PROGRESS_PAGE_SIZE).toBe(5);
  });

  it("omits zero cost-of-financing categories", () => {
    expect(
      visibleCostOfFinancingLines({
        profitOnNotes: 120,
        drawdownFees: 0,
        facilityFees: 10,
        tawidh: 0,
      })
    ).toEqual([
      { label: "Profit on notes", amount: 120 },
      { label: "Facility fees", amount: 10 },
    ]);
  });
});
