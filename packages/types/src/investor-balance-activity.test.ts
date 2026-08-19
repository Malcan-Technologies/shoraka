import {
  investorActivityDepositDetail,
  investorActivityStatusDetail,
  investorActivityStatusDisplay,
  investorActivityTitle,
  investorActivityTypeLabel,
  withdrawalIdFromMetadata,
} from "./investor-balance-activity";

describe("investorActivityTypeLabel", () => {
  it("maps cash movements to investor-facing types", () => {
    expect(investorActivityTypeLabel("MANUAL_TOPUP", null)).toBe("Deposit");
    expect(investorActivityTypeLabel("GATEWAY_DEPOSIT", null)).toBe("Deposit");
    expect(investorActivityTypeLabel("NOTE_INVESTMENT_COMMIT", null)).toBe("Investment");
    expect(investorActivityTypeLabel("INVESTOR_WITHDRAWAL_REQUEST", null)).toBe("Withdrawal");
    expect(
      investorActivityTypeLabel("NOTE_INVESTMENT_RELEASE", { releaseReason: "SETTLEMENT_PAYOUT" })
    ).toBe("Returns");
    expect(investorActivityTypeLabel("NOTE_INVESTMENT_RELEASE", { releaseReason: "FAILED_FUNDING" })).toBe(
      "Release"
    );
  });
});

describe("investorActivityTitle", () => {
  it("spells out investment lifecycle on the first line", () => {
    expect(investorActivityTitle("NOTE_INVESTMENT_COMMIT", null, null)).toBe("Investment committed");
    expect(
      investorActivityTitle("NOTE_INVESTMENT_COMMIT", null, {
        kind: "investment",
        status: "CONFIRMED",
        settledAt: "2026-08-01T00:00:00.000Z",
      })
    ).toBe("Investment confirmed");
    expect(
      investorActivityTitle("NOTE_INVESTMENT_COMMIT", null, {
        kind: "investment",
        status: "RELEASED",
        settledAt: null,
      })
    ).toBe("Investment committed");
    expect(
      investorActivityTitle("NOTE_INVESTMENT_RELEASE", { releaseReason: "FAILED_FUNDING" }, null)
    ).toBe("Investment returned");
    expect(
      investorActivityTitle("NOTE_INVESTMENT_RELEASE", { releaseReason: "SETTLEMENT_PAYOUT" }, null)
    ).toBe("Investment returns");
  });
});

describe("investorActivityStatusDisplay", () => {
  it("distinguishes reserved and confirmed investments", () => {
    expect(investorActivityStatusDisplay("NOTE_INVESTMENT_COMMIT", null)).toEqual({
      label: "Committed",
      tokenStatus: "COMMITTED",
    });
    expect(
      investorActivityStatusDisplay("NOTE_INVESTMENT_COMMIT", {
        kind: "investment",
        status: "CONFIRMED",
        settledAt: "2026-08-01T00:00:00.000Z",
      })
    ).toEqual({ label: "Confirmed", tokenStatus: "CONFIRMED" });
    expect(
      investorActivityStatusDisplay("NOTE_INVESTMENT_RELEASE", null, {
        releaseReason: "FAILED_FUNDING",
      })
    ).toEqual({ label: "Returned", tokenStatus: "RELEASED" });
  });

  it("distinguishes withdrawal approval stages", () => {
    expect(investorActivityStatusDisplay("INVESTOR_WITHDRAWAL_REQUEST", null)).toEqual({
      label: "Awaiting approval",
      tokenStatus: "PENDING_APPROVAL",
    });
    expect(
      investorActivityStatusDisplay("INVESTOR_WITHDRAWAL_REQUEST", {
        kind: "withdrawal",
        status: "LETTER_GENERATED",
        settledAt: null,
      })
    ).toEqual({ label: "Being processed", tokenStatus: "UNDER_REVIEW" });
    expect(
      investorActivityStatusDisplay("INVESTOR_WITHDRAWAL_REQUEST", {
        kind: "withdrawal",
        status: "COMPLETED",
        settledAt: "2026-08-02T00:00:00.000Z",
      })
    ).toEqual({ label: "Paid", tokenStatus: "COMPLETED" });
  });
});

describe("investorActivityStatusDetail", () => {
  it("explains withdrawal approval in investor language", () => {
    expect(investorActivityStatusDetail("INVESTOR_WITHDRAWAL_REQUEST", null)).toBe(
      "Pending CashSouk approval"
    );
    expect(
      investorActivityStatusDetail("INVESTOR_WITHDRAWAL_REQUEST", {
        kind: "withdrawal",
        status: "COMPLETED",
        settledAt: "2026-08-02T00:00:00.000Z",
      })
    ).toBe("Paid to your bank");
  });
});

describe("investorActivityDepositDetail", () => {
  it("labels deposit sources", () => {
    expect(investorActivityDepositDetail("MANUAL_TOPUP")).toBe("Wallet top-up");
    expect(investorActivityDepositDetail("GATEWAY_DEPOSIT")).toBe("Online payment");
    expect(investorActivityDepositDetail("NOTE_INVESTMENT_COMMIT")).toBeNull();
  });
});

describe("withdrawalIdFromMetadata", () => {
  it("reads a stored withdrawal id", () => {
    expect(withdrawalIdFromMetadata({ withdrawalId: "wd_1" })).toBe("wd_1");
    expect(withdrawalIdFromMetadata({ requestedByUserId: "user_1" })).toBeNull();
  });
});
