import { whyRaisingFundsSchema } from "./schemas";

describe("whyRaisingFundsSchema SC purpose of fund raising", () => {
  it("accepts a campaign enum without overwriting financing_for", () => {
    const parsed = whyRaisingFundsSchema.parse({
      financing_for: "Expand warehouse capacity in Shah Alam",
      sc_purpose_of_fund_raising: "BUSINESS_EXPANSION",
    });
    expect(parsed.financing_for).toBe("Expand warehouse capacity in Shah Alam");
    expect(parsed.sc_purpose_of_fund_raising).toBe("BUSINESS_EXPANSION");
  });

  it("requires other text when purpose is Others", () => {
    const parsed = whyRaisingFundsSchema.safeParse({
      sc_purpose_of_fund_raising: "OTHERS",
      sc_purpose_other: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts Others with a description", () => {
    const parsed = whyRaisingFundsSchema.parse({
      sc_purpose_of_fund_raising: "OTHERS",
      sc_purpose_other: "Refinance existing facilities",
    });
    expect(parsed.sc_purpose_of_fund_raising).toBe("OTHERS");
    expect(parsed.sc_purpose_other).toBe("Refinance existing facilities");
  });
});
