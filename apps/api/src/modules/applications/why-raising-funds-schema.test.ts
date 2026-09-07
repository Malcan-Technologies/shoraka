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

  it("clears other-purpose text when Purpose of Fund Raising is not Others", () => {
    const parsed = whyRaisingFundsSchema.parse({
      sc_purpose_of_fund_raising: "WORKING_CAPITAL",
      sc_purpose_other: "leftover",
    });
    expect(parsed.sc_purpose_other).toBe("");
  });

  it("accepts a payload without financing_for", () => {
    const parsed = whyRaisingFundsSchema.parse({
      sc_purpose_of_fund_raising: "WORKING_CAPITAL",
      how_funds_used: "Pay workers and buy materials",
    });
    expect(parsed.financing_for).toBe("");
    expect(parsed.sc_purpose_of_fund_raising).toBe("WORKING_CAPITAL");
    expect(parsed.how_funds_used).toBe("Pay workers and buy materials");
  });
});
