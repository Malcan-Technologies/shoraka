import {
  calendarYearFromFinancialHeaderKey,
  selectYearsFromPageTwoFinancialTable,
} from "./financial-year-keys";

describe("prospectus financial year alignment", () => {
  it("extracts calendar years from Page 2 FYE ISO header keys", () => {
    expect(calendarYearFromFinancialHeaderKey("2022-12-31")).toBe("2022");
    expect(calendarYearFromFinancialHeaderKey("2024")).toBe("2024");
  });

  it("keeps Page 2 header order for Page 3 year columns", () => {
    const years = selectYearsFromPageTwoFinancialTable({
      yearHeaders: [
        { key: "2022-12-31" },
        { key: "2023-12-31" },
        { key: "2024-12-31" },
      ],
    });
    expect(years).toEqual(["2022", "2023", "2024"]);
  });

  it("does not drop a year when only two calendar keys would be selected live", () => {
    const page2Years = selectYearsFromPageTwoFinancialTable({
      yearHeaders: [
        { key: "2022-12-31" },
        { key: "2023-12-31" },
        { key: "2024-12-31" },
      ],
    });
    expect(page2Years).toHaveLength(3);
    expect(page2Years).toContain("2022");
  });
});
