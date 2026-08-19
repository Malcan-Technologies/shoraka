import {
  depositLimitsHint,
  depositMaximumError,
  depositMinimumError,
  formatBankAccountHint,
  withdrawMinimumError,
  withdrawMinimumHint,
} from "./investor-money-copy";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
}));

describe("investor money copy", () => {
  it("writes deposit and withdrawal limits for investors", () => {
    expect(depositLimitsHint(100, 50000)).toBe("You can add from RM 100 to RM 50000.");
    expect(depositMinimumError(100)).toBe("The minimum you can add is RM 100.");
    expect(depositMaximumError(50000)).toBe("The most you can add at once is RM 50000.");
    expect(withdrawMinimumHint(100)).toBe("You can withdraw from RM 100.");
    expect(withdrawMinimumError(100)).toBe("The minimum you can withdraw is RM 100.");
  });

  it("masks bank account numbers and leaves placeholders alone", () => {
    expect(formatBankAccountHint("123456789012")).toBe("ending 9012");
    expect(formatBankAccountHint("12-3456-7890")).toBe("ending 7890");
    expect(formatBankAccountHint("Not set")).toBe("Not set");
    expect(formatBankAccountHint("Loading...")).toBe("Loading...");
    expect(formatBankAccountHint("")).toBe("Not set");
  });
});
