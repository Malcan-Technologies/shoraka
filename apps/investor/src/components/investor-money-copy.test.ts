import {
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
  it("writes deposit and withdrawal limits for investors", () => {
    expect(depositLimitsHint(100, 50000)).toBe("You can add from RM 100 to RM 50000.");
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
