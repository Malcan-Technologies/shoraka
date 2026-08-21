import {
  getUserPortalStatusToken,
  isOnboardingVerified,
  onboardingActionIconClass,
  onboardingStatusLabel,
  onboardingStatusToToken,
} from "./portal-status-token";

describe("getUserPortalStatusToken", () => {
  it("maps draft and withdrawn to grey", () => {
    expect(getUserPortalStatusToken("DRAFT")).toBe("neutral");
    expect(getUserPortalStatusToken("WITHDRAWN")).toBe("neutral");
    expect(getUserPortalStatusToken("CANCELLED")).toBe("neutral");
  });

  it("maps your-action statuses to yellow", () => {
    expect(getUserPortalStatusToken("OFFER_SENT")).toBe("action");
    expect(getUserPortalStatusToken("AMENDMENT_REQUESTED")).toBe("action");
    expect(getUserPortalStatusToken("CONTRACT_SENT")).toBe("action");
  });

  it("maps waiting-on-CashSouk statuses to blue", () => {
    expect(getUserPortalStatusToken("SUBMITTED")).toBe("submitted");
    expect(getUserPortalStatusToken("UNDER_REVIEW")).toBe("submitted");
    expect(getUserPortalStatusToken("FUNDED")).toBe("submitted");
    expect(getUserPortalStatusToken("VIEWED")).toBe("submitted");
    expect(getUserPortalStatusToken("COMMITTED")).toBe("submitted");
    expect(getUserPortalStatusToken("LETTER_GENERATED")).toBe("submitted");
    expect(getUserPortalStatusToken("NAME_CHECK_PENDING")).toBe("submitted");
    expect(getUserPortalStatusToken("NAME_CHECK_PENDING")).toBe("submitted");
  });

  it("maps live and terminal positives", () => {
    expect(getUserPortalStatusToken("ACTIVE")).toBe("active");
    expect(getUserPortalStatusToken("CONFIRMED")).toBe("active");
    expect(getUserPortalStatusToken("COMPLETED")).toBe("success");
    expect(getUserPortalStatusToken("SETTLED")).toBe("success");
  });

  it("maps failures to red", () => {
    expect(getUserPortalStatusToken("REJECTED")).toBe("rejected");
    expect(getUserPortalStatusToken("ARREARS")).toBe("rejected");
    expect(getUserPortalStatusToken("OFFER_EXPIRED")).toBe("rejected");
  });
});

describe("onboardingStatusToToken", () => {
  it("maps amendment to yellow and pending approval to blue", () => {
    expect(onboardingStatusToToken("PENDING_AMENDMENT")).toBe("action");
    expect(onboardingStatusToToken("PENDING_APPROVAL")).toBe("submitted");
    expect(onboardingStatusToToken("PENDING_AML")).toBe("submitted");
    expect(onboardingStatusToToken("IN_PROGRESS")).toBe("submitted");
  });

  it("maps verified, rejected, and expired", () => {
    expect(onboardingStatusToToken("COMPLETED")).toBe("success");
    expect(onboardingStatusToToken("REJECTED")).toBe("rejected");
    expect(onboardingStatusToToken("PENDING", "EXPIRED")).toBe("rejected");
  });

  it("keeps shared labels", () => {
    expect(onboardingStatusLabel("COMPLETED")).toBe("Verified");
    expect(onboardingStatusLabel("PENDING_AML")).toBe("Pending AML Approval");
    expect(onboardingStatusLabel("PENDING_AMENDMENT")).toBe("Amendment in Progress");
    expect(onboardingStatusLabel("PENDING_APPROVAL")).toBe("Pending Approval");
    expect(isOnboardingVerified("COMPLETED")).toBe(true);
    expect(isOnboardingVerified("PENDING_APPROVAL")).toBe(false);
  });

  it("uses status token surfaces for org-switcher icons", () => {
    expect(onboardingActionIconClass("PENDING_APPROVAL")).toContain("bg-status-submitted-bg");
    expect(onboardingActionIconClass("PENDING_AMENDMENT")).toContain("bg-status-action-bg");
    expect(onboardingActionIconClass("COMPLETED")).toContain("bg-status-success-bg");
  });
});
