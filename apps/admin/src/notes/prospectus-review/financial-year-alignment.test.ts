import {
  calendarYearFromFinancialHeaderKey,
  selectYearsFromPageTwoFinancialTable,
} from "./financial-year-keys";

describe("prospectus frozen financial year keys", () => {
  it("extracts calendar years from Page 2 FYE ISO header keys", () => {
    expect(calendarYearFromFinancialHeaderKey("2022-12-31")).toBe("2022");
    expect(calendarYearFromFinancialHeaderKey("2024")).toBe("2024");
  });

  it("keeps Page 2 header order for frozen year columns", () => {
    const years = selectYearsFromPageTwoFinancialTable({
      yearHeaders: [
        { key: "2022-12-31" },
        { key: "2023-12-31" },
        { key: "2024-12-31" },
      ],
    });
    expect(years).toEqual(["2022", "2023", "2024"]);
  });
});
