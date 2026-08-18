import { getFinalStatusLabel, getFinalStatusToken } from "@cashsouk/types";

describe("getFinalStatusToken", () => {
  it("maps Action Required to yellow and Pending Review to blue", () => {
    expect(
      getFinalStatusToken(
        getFinalStatusLabel({ onboarding: { status: "ACTION_REQUIRED" } }).tone
      )
    ).toBe("action");
    expect(
      getFinalStatusToken(
        getFinalStatusLabel({ onboarding: { status: "PENDING_APPROVAL" } }).tone
      )
    ).toBe("submitted");
  });

  it("maps verified, rejected, expired, and not started", () => {
    expect(getFinalStatusToken(getFinalStatusLabel({ onboarding: { status: "APPROVED" } }).tone)).toBe(
      "success"
    );
    expect(
      getFinalStatusToken(getFinalStatusLabel({ screening: { status: "REJECTED" } }).tone)
    ).toBe("rejected");
    expect(
      getFinalStatusToken(getFinalStatusLabel({ onboarding: { status: "EXPIRED" } }).tone)
    ).toBe("rejected");
    expect(getFinalStatusToken(getFinalStatusLabel({}).tone)).toBe("neutral");
  });
});
