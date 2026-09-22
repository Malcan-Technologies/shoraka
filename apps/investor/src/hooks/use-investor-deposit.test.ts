import {
  isDepositWalletSettled,
  isTerminalDepositStatus,
} from "./investor-deposit-status";

describe("investor deposit wallet settlement", () => {
  it("treats gateway-returned name-check and hold as terminal but not wallet-settled", () => {
    expect(isTerminalDepositStatus("NAME_CHECK_PENDING")).toBe(true);
    expect(isTerminalDepositStatus("HELD")).toBe(true);
    expect(isDepositWalletSettled("NAME_CHECK_PENDING")).toBe(false);
    expect(isDepositWalletSettled("HELD")).toBe(false);
  });

  it("settles the wallet only after credit, failure, or refund", () => {
    expect(isDepositWalletSettled("COMPLETED")).toBe(true);
    expect(isDepositWalletSettled("FAILED")).toBe(true);
    expect(isDepositWalletSettled("EXPIRED")).toBe(true);
    expect(isDepositWalletSettled("REFUNDED")).toBe(true);
    expect(isDepositWalletSettled("REFUND_INITIATED")).toBe(true);
    expect(isDepositWalletSettled("CREATED")).toBe(false);
    expect(isDepositWalletSettled("PAID")).toBe(false);
  });
});
