import { issuerResponseBannerKind } from "./issuer-response-banner";

describe("issuerResponseBannerKind", () => {
  it("waits only while the offer is sent and the issuer has not submitted", () => {
    expect(issuerResponseBannerKind({ entityStatus: "OFFER_SENT" })).toBe("waiting");
    expect(
      issuerResponseBannerKind({
        entityStatus: "OFFER_SENT",
        acceptanceStatus: "PENDING_ISSUER",
      })
    ).toBe("waiting");
  });

  it("treats later acceptance phases as accepted, not waiting", () => {
    expect(
      issuerResponseBannerKind({
        entityStatus: "OFFER_SENT",
        acceptanceStatus: "PENDING_ADMIN_REVIEW",
      })
    ).toBe("accepted");
    expect(
      issuerResponseBannerKind({
        entityStatus: "OFFER_SENT",
        acceptanceStatus: "APPROVED_FOR_SIGNING",
      })
    ).toBe("accepted");
    expect(
      issuerResponseBannerKind({
        entityStatus: "OFFER_SENT",
        acceptanceStatus: "SIGNING_IN_PROGRESS",
      })
    ).toBe("accepted");
    expect(
      issuerResponseBannerKind({
        entityStatus: "APPROVED",
        acceptanceStatus: "COMPLETED",
      })
    ).toBe("accepted");
  });

  it("shows changes requested instead of waiting", () => {
    expect(
      issuerResponseBannerKind({
        entityStatus: "OFFER_SENT",
        acceptanceStatus: "CHANGES_REQUESTED",
      })
    ).toBe("changes");
  });

  it("treats issuer decline as withdrawn or DECLINED, not admin REJECTED", () => {
    expect(issuerResponseBannerKind({ entityStatus: "WITHDRAWN" })).toBe("declined");
    expect(
      issuerResponseBannerKind({
        entityStatus: "OFFER_SENT",
        acceptanceStatus: "DECLINED",
      })
    ).toBe("declined");
    expect(issuerResponseBannerKind({ entityStatus: "REJECTED" })).toBe("review");
  });
});
