import { formatFinancingTenureFromDisbursement, resolveFinancingTenureDays } from "@cashsouk/types";

describe("invoice offer tenure display", () => {
  it("resolves the frozen offer tenure and formats acceptance copy", () => {
    expect(
      resolveFinancingTenureDays(
        { financing_tenure_days: 105 },
        { financing_tenure_days: 90 }
      )
    ).toBe(105);
    expect(formatFinancingTenureFromDisbursement(90)).toBe("90 days from disbursement");
  });
});
