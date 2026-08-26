import { investmentDateKpiValueClassName } from "./investment-date-kpi";

describe("investmentDateKpiValueClassName", () => {
  it("keeps short countdown values large and shrinks dates", () => {
    expect(investmentDateKpiValueClassName("90")).toContain("text-foreground");
    expect(investmentDateKpiValueClassName("90")).not.toContain("text-xl");
    expect(investmentDateKpiValueClassName("Today")).not.toContain("text-xl");
    expect(investmentDateKpiValueClassName("1 Aug 2026")).toContain("text-xl");
  });

  it("marks overdue values in the rejected colour", () => {
    expect(investmentDateKpiValueClassName("7", "overdue")).toContain("text-status-rejected-text");
  });
});
