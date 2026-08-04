import { offerAcceptanceAllowsIssuerReviewCta } from "@cashsouk/types";
import {
  getIssuerOfferActionCta,
  getIssuerOfferActionCtaFromOfferDetails,
  getOfferPhaseDeadlineDisplay,
  getOfferStatus,
  getPhaseDeadlineUrgency,
  shouldShowIssuerReviewOfferCta,
} from "./offer-utils";

describe("offerAcceptanceAllowsIssuerReviewCta", () => {
  it("allows legacy offers with no status", () => {
    expect(offerAcceptanceAllowsIssuerReviewCta(null)).toBe(true);
    expect(offerAcceptanceAllowsIssuerReviewCta(undefined)).toBe(true);
  });

  it("shows CTA for Step 1 and Step 3 statuses", () => {
    expect(offerAcceptanceAllowsIssuerReviewCta("PENDING_ISSUER")).toBe(true);
    expect(offerAcceptanceAllowsIssuerReviewCta("CHANGES_REQUESTED")).toBe(true);
    expect(offerAcceptanceAllowsIssuerReviewCta("APPROVED_FOR_SIGNING")).toBe(true);
    expect(offerAcceptanceAllowsIssuerReviewCta("SIGNING_IN_PROGRESS")).toBe(true);
  });

  it("hides CTA while waiting on admin or after reject/complete", () => {
    expect(offerAcceptanceAllowsIssuerReviewCta("PENDING_ADMIN_REVIEW")).toBe(false);
    expect(offerAcceptanceAllowsIssuerReviewCta("REJECTED")).toBe(false);
    expect(offerAcceptanceAllowsIssuerReviewCta("COMPLETED")).toBe(false);
  });
});

describe("shouldShowIssuerReviewOfferCta", () => {
  it("is false when there is no offer", () => {
    expect(shouldShowIssuerReviewOfferCta({ status: "SUBMITTED", offer_details: {} })).toBe(false);
  });

  it("is true for OFFER_SENT without offer_acceptance (legacy)", () => {
    expect(
      shouldShowIssuerReviewOfferCta({
        status: "OFFER_SENT",
        offer_details: {},
      })
    ).toBe(true);
  });

  it("is false while PENDING_ADMIN_REVIEW", () => {
    expect(
      shouldShowIssuerReviewOfferCta({
        status: "OFFER_SENT",
        offer_details: {
          offer_acceptance: {
            status: "PENDING_ADMIN_REVIEW",
            acceptance_expires_at: "2099-01-01T00:00:00.000Z",
          },
        },
      })
    ).toBe(false);
  });

  it("is true for PENDING_ISSUER and APPROVED_FOR_SIGNING", () => {
    expect(
      shouldShowIssuerReviewOfferCta({
        status: "OFFER_SENT",
        offer_details: {
          offer_acceptance: {
            status: "PENDING_ISSUER",
            acceptance_expires_at: "2099-01-01T00:00:00.000Z",
          },
        },
      })
    ).toBe(true);
    expect(
      shouldShowIssuerReviewOfferCta({
        status: "OFFER_SENT",
        offer_details: {
          offer_acceptance: {
            status: "APPROVED_FOR_SIGNING",
            signing_expires_at: "2099-01-01T00:00:00.000Z",
          },
        },
      })
    ).toBe(true);
  });

  it("getOfferStatus still reports Offer received while CTA is hidden", () => {
    const item = {
      status: "OFFER_SENT",
      offer_details: {
        offer_acceptance: {
          status: "PENDING_ADMIN_REVIEW",
          acceptance_expires_at: "2099-01-01T00:00:00.000Z",
        },
      },
    };
    expect(getOfferStatus(item)).toBe("Offer received");
    expect(shouldShowIssuerReviewOfferCta(item)).toBe(false);
  });

  it("hides CTA when acceptance deadline has passed", () => {
    const item = {
      status: "OFFER_SENT",
      offer_details: {
        offer_acceptance: {
          status: "PENDING_ISSUER",
          acceptance_expires_at: "2000-01-01T00:00:00.000Z",
        },
      },
    };
    expect(getOfferStatus(item)).toBe("Offer expired");
    expect(shouldShowIssuerReviewOfferCta(item)).toBe(false);
  });
});

describe("getOfferStatus", () => {
  it("returns Offer received when no deadline is stamped", () => {
    expect(
      getOfferStatus({
        status: "OFFER_SENT",
        offer_details: { offer_acceptance: { status: "PENDING_ISSUER" } },
      })
    ).toBe("Offer received");
  });

  it("returns null when not OFFER_SENT or OFFER_EXPIRED", () => {
    expect(getOfferStatus({ status: "APPROVED", offer_details: {} })).toBe(null);
  });

  it("returns Offer expired for durable OFFER_EXPIRED status", () => {
    expect(
      getOfferStatus({
        status: "OFFER_EXPIRED",
        offer_details: {
          offer_acceptance: {
            status: "PENDING_ISSUER",
            acceptance_expires_at: "2000-01-01T00:00:00.000Z",
          },
        },
      })
    ).toBe("Offer expired");
    expect(
      shouldShowIssuerReviewOfferCta({
        status: "OFFER_EXPIRED",
        offer_details: {
          offer_acceptance: {
            status: "PENDING_ISSUER",
            acceptance_expires_at: "2000-01-01T00:00:00.000Z",
          },
        },
      })
    ).toBe(false);
  });
});

describe("getPhaseDeadlineUrgency", () => {
  const now = new Date("2026-07-22T06:00:00.000Z");

  it("is none when more than 2 calendar days remain", () => {
    expect(getPhaseDeadlineUrgency("2026-07-29T16:00:00.000Z", now)).toBe("none");
  });

  it("is soon when within 2 calendar days", () => {
    expect(getPhaseDeadlineUrgency("2026-07-24T16:00:00.000Z", now)).toBe("soon");
    expect(getPhaseDeadlineUrgency("2026-07-23T16:00:00.000Z", now)).toBe("soon");
  });

  it("is past when the deadline has passed", () => {
    expect(getPhaseDeadlineUrgency("2026-07-21T16:00:00.000Z", now)).toBe("past");
  });
});

describe("getOfferPhaseDeadlineDisplay", () => {
  const now = new Date("2026-07-22T06:00:00.000Z");
  const liveExpiresAt = "2026-07-23T16:00:00.000Z";

  it("includes 11:59 PM in live summary with Accept by label", () => {
    const display = getOfferPhaseDeadlineDisplay(
      {
        offer_acceptance: {
          status: "PENDING_ISSUER",
          acceptance_expires_at: liveExpiresAt,
        },
      },
      now
    );
    expect(display?.label).toBe("Accept by");
    expect(display?.urgency).toBe("soon");
    expect(display?.absolute).toBe("23 Jul 2026, 11:59 PM");
    expect(display?.summary).toContain("Accept by 23 Jul 2026, 11:59 PM");
  });

  it("uses Expired label and datetime-only summary when past", () => {
    const display = getOfferPhaseDeadlineDisplay(
      {
        offer_acceptance: {
          status: "PENDING_ISSUER",
          acceptance_expires_at: "2026-07-21T16:00:00.000Z",
        },
      },
      now
    );
    expect(display?.label).toBe("Expired");
    expect(display?.urgency).toBe("past");
    expect(display?.summary).toBe(`Expired ${display!.absolute}`);
    expect(display?.summary).not.toContain("Accept by");
    expect(display?.summary).not.toContain("·");
  });

  it("returns null when no deadline is stamped", () => {
    expect(
      getOfferPhaseDeadlineDisplay({
        offer_acceptance: { status: "PENDING_ISSUER" },
      })
    ).toBe(null);
  });
});

describe("getIssuerOfferActionCta", () => {
  it("uses Update acceptance documents for CHANGES_REQUESTED", () => {
    const cta = getIssuerOfferActionCta("CHANGES_REQUESTED", { scope: "contract" });
    expect(cta.label).toBe("Update acceptance documents");
    expect(cta.hint).toContain("requested changes");
    expect(cta.buttonVariant).toBe("makeAmendments");
    expect(cta.isAcceptanceChangesRequested).toBe(true);
  });

  it("uses Review Contract Financing Offer for PENDING_ISSUER contract scope", () => {
    const cta = getIssuerOfferActionCta("PENDING_ISSUER", { scope: "contract" });
    expect(cta.label).toBe("Review Contract Financing Offer");
    expect(cta.hint).toBeNull();
    expect(cta.buttonVariant).toBe("reviewOffer");
  });

  it("reads phase from offer_details", () => {
    const cta = getIssuerOfferActionCtaFromOfferDetails(
      { offer_acceptance: { status: "CHANGES_REQUESTED" } },
      { scope: "invoice" }
    );
    expect(cta.label).toBe("Update acceptance documents");
  });
});
