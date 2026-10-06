import {
  dashboardParticipationHint,
  depositHeadroomBlockedHint,
  depositLimitsHint,
  depositMaximumError,
  depositMinimumError,
  depositTypedAmountError,
  formatBankAccountHint,
  withdrawLimitsHint,
  withdrawMaximumError,
  withdrawMinimumError,
  withdrawTypedAmountError,
} from "./investor-money-copy";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
}));

describe("investor money copy", () => {
  it("writes the dashboard participation hint from the type cap", () => {
    expect(dashboardParticipationHint()).toBe("Limit depends on investor type");
    expect(dashboardParticipationHint(null)).toBe("Limit depends on investor type");
    expect(dashboardParticipationHint({ tier: "SOPHISTICATED", limit: null })).toBe(
      "No cap on outstanding principal"
    );
    expect(dashboardParticipationHint({ tier: "RETAIL", limit: 400000 })).toBe(
      "Retail cap RM 400000 outstanding"
    );
    expect(
      dashboardParticipationHint({ classificationRequired: true, tier: "RETAIL", limit: 0 })
    ).toBe("Set your Type of Investor to see your limit");
  });

  it("writes deposit and withdrawal limits for investors", () => {
    expect(depositLimitsHint(100, 50000)).toBe("You can add from RM 100 to RM 50000.");
    expect(depositLimitsHint(100, 10000, { tier: "RETAIL", limit: 50000 })).toBe(
      "You can add from RM 100 to RM 10000. Remaining under your Retail limit of RM 50000."
    );
    expect(
      depositLimitsHint(100, 30000, { tier: "RETAIL", limit: 400000, depositHeadroom: 129000 })
    ).toBe(
      "You can add from RM 100 to RM 30000. You can deposit up to RM 129000 more under your Retail limit of RM 400000."
    );
    expect(depositHeadroomBlockedHint(50, 100, { tier: "RETAIL", limit: 50000 })).toBe(
      "You can deposit up to RM 50 more under your Retail limit of RM 50000. The minimum deposit is RM 100."
    );
    expect(
      depositHeadroomBlockedHint(0, 100, {
        tier: "RETAIL",
        limit: 245000,
        pendingDeposits: 31000,
      })
    ).toBe(
      "You can deposit up to RM 0 more under your Retail limit of RM 245000, including RM 31000 still clearing. The minimum deposit is RM 100."
    );
    expect(depositMinimumError(100)).toBe("The minimum you can add is RM 100.");
    expect(depositMaximumError(50000)).toBe("The most you can add at once is RM 50000.");
    expect(depositTypedAmountError(0, 100, 50000)).toBeNull();
    expect(depositTypedAmountError(50, 100, 50000)).toBe("The minimum you can add is RM 100.");
    expect(depositTypedAmountError(60000, 100, 50000)).toBe(
      "The most you can add at once is RM 50000."
    );
    expect(depositTypedAmountError(500, 100, 50000)).toBeNull();
    expect(withdrawLimitsHint(100, 1250)).toBe("You can withdraw from RM 100 to RM 1250.");
    expect(withdrawLimitsHint(100, 50)).toBe("You need at least RM 100 available cash to withdraw.");
    expect(withdrawMinimumError(100)).toBe("The minimum you can withdraw is RM 100.");
    expect(withdrawMaximumError(1250)).toBe("The most you can withdraw is RM 1250.");
    expect(withdrawTypedAmountError(0, 100, 1250)).toBeNull();
    expect(withdrawTypedAmountError(50, 100, 1250)).toBe(
      "The minimum you can withdraw is RM 100."
    );
    expect(withdrawTypedAmountError(2000, 100, 1250)).toBe(
      "The most you can withdraw is RM 1250."
    );
    expect(withdrawTypedAmountError(250, 100, 1250)).toBeNull();
  });

  it("masks bank account numbers and leaves placeholders alone", () => {
    expect(formatBankAccountHint("123456789012")).toBe("ending 9012");
    expect(formatBankAccountHint("12-3456-7890")).toBe("ending 7890");
    expect(formatBankAccountHint("Not set")).toBe("Not set");
    expect(formatBankAccountHint("Loading...")).toBe("Loading...");
    expect(formatBankAccountHint("")).toBe("Not set");
  });
});
