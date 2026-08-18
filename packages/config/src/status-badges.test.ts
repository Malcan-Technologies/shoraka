import { badgeKeyToStatusToken, getStatusPresentation, getStatusPresentationByBadgeKey } from "./status-badges";

describe("badgeKeyToStatusToken", () => {
  it("maps draft and withdrawn to grey", () => {
    expect(badgeKeyToStatusToken("draft")).toBe("neutral");
    expect(badgeKeyToStatusToken("withdrawn")).toBe("neutral");
    expect(badgeKeyToStatusToken("archived")).toBe("neutral");
  });

  it("maps issuer-must-act keys to yellow", () => {
    expect(badgeKeyToStatusToken("offer_sent")).toBe("action");
    expect(badgeKeyToStatusToken("amendment_requested")).toBe("action");
  });

  it("maps waiting-on-CashSouk keys to blue", () => {
    expect(badgeKeyToStatusToken("submitted")).toBe("submitted");
    expect(badgeKeyToStatusToken("resubmitted")).toBe("submitted");
    expect(badgeKeyToStatusToken("under_review")).toBe("submitted");
  });

  it("maps completed and approved to green", () => {
    expect(badgeKeyToStatusToken("completed")).toBe("success");
    expect(badgeKeyToStatusToken("approved")).toBe("success");
    expect(badgeKeyToStatusToken("accepted")).toBe("success");
  });

  it("maps failures to red", () => {
    expect(badgeKeyToStatusToken("rejected")).toBe("rejected");
    expect(badgeKeyToStatusToken("declined")).toBe("rejected");
    expect(badgeKeyToStatusToken("offer_expired")).toBe("rejected");
  });
});

describe("status presentation groups", () => {
  it("paints DRAFT grey", () => {
    expect(getStatusPresentation("DRAFT").variant).toBe("neutral");
    expect(getStatusPresentation("DRAFT").badgeClass).toContain("bg-status-neutral-bg");
  });

  it("paints issuer card completed green", () => {
    const pres = getStatusPresentationByBadgeKey("completed");
    expect(pres.color).toContain("bg-status-success-bg");
    expect(pres.label).toBe("Completed");
  });

  it("paints issuer card withdrawn grey", () => {
    const pres = getStatusPresentationByBadgeKey("withdrawn", undefined, {
      issuerWithdrawPresentation: true,
    });
    expect(pres.color).toContain("bg-status-neutral-bg");
  });
});
