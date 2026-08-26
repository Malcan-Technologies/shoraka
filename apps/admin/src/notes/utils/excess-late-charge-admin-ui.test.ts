jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import { excessLateChargeCompletedCopy, excessLateChargeWaitingCopy } from "./excess-late-charge-admin-ui";

describe("admin excess late charge copy", () => {
  it("tells admin the issuer was asked to pay the leftover charges", () => {
    expect(excessLateChargeWaitingCopy(250)).toBe(
      "RM 250.00 in late charges did not fit into the repayment. The issuer has been asked to pay it separately."
    );
  });

  it("uses a concise completed state when the issuer has paid", () => {
    expect(excessLateChargeCompletedCopy(250)).toBe(
      "RM 250.00 in separately billed late charges has been paid."
    );
  });
});
