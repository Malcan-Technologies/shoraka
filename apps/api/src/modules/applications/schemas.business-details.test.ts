import {
  businessDetailsDataSchema,
  businessDetailsInheritedGuarantorsDataSchema,
} from "./schemas";

const fundraising = {
  declaration_confirmed: true,
  why_raising_funds: {
    financing_for: "Working capital",
    how_funds_used: "Inventory",
    business_plan: "Grow",
    risks_delay_repayment: "None",
    backup_plan: "Reserve",
    raising_on_other_p2p: false,
  },
};

describe("business details schemas", () => {
  it("requires at least one guarantor on a facility or invoice-only application", () => {
    const result = businessDetailsDataSchema.safeParse({
      ...fundraising,
      guarantors: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "guarantors")).toBe(
        true
      );
    }
  });

  it("allows empty guarantors when a drawdown inherits facility guarantors", () => {
    const result = businessDetailsInheritedGuarantorsDataSchema.safeParse({
      ...fundraising,
      guarantors: [],
    });
    expect(result.success).toBe(true);
  });
});
