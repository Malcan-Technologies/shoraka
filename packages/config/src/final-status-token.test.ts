import { getFinalStatusLabel, getFinalStatusToken, getRelatedPartyStatusToken } from "@cashsouk/types";

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
    expect(
      getFinalStatusToken(
        getFinalStatusLabel({ onboarding: { status: "NOT_STARTED" } }, { displayMode: "kyc_only" }).tone
      )
    ).toBe("neutral");
  });
});

describe("getRelatedPartyStatusToken", () => {
  it("uses yellow for admin-action pending on admin and blue on issuer/investor", () => {
    const pending = getFinalStatusLabel({ onboarding: { status: "WAIT_FOR_APPROVAL" } });
    expect(pending.label).toBe("Pending Review");
    expect(getRelatedPartyStatusToken(pending, "admin")).toBe("action");
    expect(getRelatedPartyStatusToken(pending, "user")).toBe("submitted");
  });

  it("uses blue for user-action pending on admin and yellow on issuer/investor", () => {
    const inProgress = getFinalStatusLabel({ onboarding: { status: "IN_PROGRESS" } });
    expect(inProgress.label).toBe("In Progress");
    expect(getRelatedPartyStatusToken(inProgress, "admin")).toBe("submitted");
    expect(getRelatedPartyStatusToken(inProgress, "user")).toBe("action");
  });

  it("keeps draft grey, failure red, and approved green", () => {
    expect(getRelatedPartyStatusToken(getFinalStatusLabel({}), "admin")).toBe("neutral");
    expect(
      getRelatedPartyStatusToken(getFinalStatusLabel({ screening: { status: "REJECTED" } }), "admin")
    ).toBe("rejected");
    expect(
      getRelatedPartyStatusToken(getFinalStatusLabel({ onboarding: { status: "FAILED" } }), "user")
    ).toBe("rejected");
    expect(
      getRelatedPartyStatusToken(getFinalStatusLabel({ onboarding: { status: "APPROVED" } }), "admin")
    ).toBe("success");
  });

  it("maps URL_GENERATED to In Progress and COMPLETED to Completed", () => {
    expect(getFinalStatusLabel({ onboarding: { status: "URL_GENERATED" } }).label).toBe("In Progress");
    expect(getFinalStatusLabel({ onboarding: { status: "COMPLETED" } }).label).toBe("Completed");
    expect(getFinalStatusLabel({ onboarding: { status: "WAIT_FOR_APPROVAL" } }).label).toBe(
      "Pending Review"
    );
  });
});
