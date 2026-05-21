import {
  computeExpectedPayoutAmount,
  computeNetExpectedReturnRatePercent,
  formatInvestorReturnRatePercent,
  resolveNetExpectedReturnRatePercent,
  roundNoteMoney,
} from "@cashsouk/types";

describe("note expected return (net of service fee)", () => {
  it("reduces gross profit rate by service fee on profit", () => {
    expect(computeNetExpectedReturnRatePercent(12, 15)).toBe(10.2);
  });

  it("returns null when gross profit rate is missing", () => {
    expect(computeNetExpectedReturnRatePercent(null, 15)).toBeNull();
  });

  it("computes expected payout from principal and net rate", () => {
    const payout = computeExpectedPayoutAmount(1000, 10.2);
    expect(roundNoteMoney(payout, 2)).toBe(1102);
  });

  it("rounds resolved rate to one decimal for display", () => {
    expect(
      resolveNetExpectedReturnRatePercent({
        profitRatePercent: 18,
        serviceFeeRatePercent: 15,
      })
    ).toBe(15.3);
  });

  it("formats rate without floating-point noise", () => {
    expect(formatInvestorReturnRatePercent(15.299999999999998)).toBe("15.3%");
  });

  it("rounds money to two decimals with half-up behaviour", () => {
    expect(roundNoteMoney(10.005, 2)).toBe(10.01);
    expect(roundNoteMoney(10.004, 2)).toBe(10);
    expect(roundNoteMoney(1.005 + 2.005, 2)).toBe(3.01);
  });
});
