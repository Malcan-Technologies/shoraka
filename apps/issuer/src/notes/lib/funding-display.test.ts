import {
  isIssuerNoteFundingFailed,
  issuerNoteDisplayFundedAmount,
  issuerNoteDisplayFundingPercent,
  issuerNoteDisplayFundingRatio,
} from "./funding-display";

describe("issuer note funding display after fail funding", () => {
  it("treats FAILED funding status and FAILED_FUNDING note status as failed", () => {
    expect(isIssuerNoteFundingFailed({ fundingStatus: "FAILED" })).toBe(true);
    expect(isIssuerNoteFundingFailed({ status: "FAILED_FUNDING", fundingStatus: "OPEN" })).toBe(
      true
    );
    expect(isIssuerNoteFundingFailed({ fundingStatus: "FUNDED" })).toBe(false);
    expect(isIssuerNoteFundingFailed({ fundingStatus: "OPEN" })).toBe(false);
    expect(isIssuerNoteFundingFailed({ status: "ACTIVE", fundingStatus: "FUNDED" })).toBe(false);
  });

  it("zeros displayed funded amount, percent, and ratio after fail funding", () => {
    expect(
      issuerNoteDisplayFundedAmount({ fundingStatus: "FAILED", fundedAmount: 400 })
    ).toBe(0);
    expect(
      issuerNoteDisplayFundingPercent({ fundingStatus: "FAILED", fundingPercent: 4.8 })
    ).toBe(0);
    expect(
      issuerNoteDisplayFundingRatio({
        status: "FAILED_FUNDING",
        fundingStatus: "FAILED",
        fundedAmount: 400,
        targetAmount: 8333.33,
      })
    ).toBe(0);
    expect(
      issuerNoteDisplayFundedAmount({
        status: "FAILED_FUNDING",
        fundingStatus: "CLOSED",
        fundedAmount: 400,
      })
    ).toBe(0);
  });

  it("keeps the real raise on successful open and funded notes", () => {
    expect(
      issuerNoteDisplayFundedAmount({ fundingStatus: "OPEN", fundedAmount: 400 })
    ).toBe(400);
    expect(
      issuerNoteDisplayFundingPercent({ fundingStatus: "OPEN", fundingPercent: 4.8 })
    ).toBe(4.8);
    expect(
      issuerNoteDisplayFundingRatio({
        fundingStatus: "OPEN",
        fundedAmount: 400,
        targetAmount: 8333.33,
      })
    ).toBeCloseTo((400 / 8333.33) * 100);
    expect(
      issuerNoteDisplayFundedAmount({
        status: "ACTIVE",
        fundingStatus: "FUNDED",
        fundedAmount: 8000,
      })
    ).toBe(8000);
    expect(
      issuerNoteDisplayFundingPercent({
        status: "ACTIVE",
        fundingStatus: "FUNDED",
        fundingPercent: 100,
      })
    ).toBe(100);
    expect(
      issuerNoteDisplayFundingRatio({
        status: "ACTIVE",
        fundingStatus: "FUNDED",
        fundedAmount: 8000,
        targetAmount: 8000,
      })
    ).toBe(100);
  });
});
