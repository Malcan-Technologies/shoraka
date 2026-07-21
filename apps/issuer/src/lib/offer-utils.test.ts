import { offerAcceptanceAllowsIssuerReviewCta } from "@cashsouk/types";
import { getOfferStatus, shouldShowIssuerReviewOfferCta } from "./offer-utils";

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
        offer_details: { expires_at: "2099-01-01T00:00:00.000Z" },
      })
    ).toBe(true);
  });

  it("is false while PENDING_ADMIN_REVIEW", () => {
    expect(
      shouldShowIssuerReviewOfferCta({
        status: "OFFER_SENT",
        offer_details: {
          expires_at: "2099-01-01T00:00:00.000Z",
          offer_acceptance: { status: "PENDING_ADMIN_REVIEW" },
        },
      })
    ).toBe(false);
  });

  it("is true for PENDING_ISSUER and APPROVED_FOR_SIGNING", () => {
    expect(
      shouldShowIssuerReviewOfferCta({
        status: "OFFER_SENT",
        offer_details: {
          expires_at: "2099-01-01T00:00:00.000Z",
          offer_acceptance: { status: "PENDING_ISSUER" },
        },
      })
    ).toBe(true);
    expect(
      shouldShowIssuerReviewOfferCta({
        status: "OFFER_SENT",
        offer_details: {
          expires_at: "2099-01-01T00:00:00.000Z",
          offer_acceptance: { status: "APPROVED_FOR_SIGNING" },
        },
      })
    ).toBe(true);
  });

  it("getOfferStatus still reports Offer received while CTA is hidden", () => {
    const item = {
      status: "OFFER_SENT",
      offer_details: {
        expires_at: "2099-01-01T00:00:00.000Z",
        offer_acceptance: { status: "PENDING_ADMIN_REVIEW" },
      },
    };
    expect(getOfferStatus(item)).toBe("Offer received");
    expect(shouldShowIssuerReviewOfferCta(item)).toBe(false);
  });

  it("hides CTA when offer is expired", () => {
    const item = {
      status: "OFFER_SENT",
      offer_details: {
        expires_at: "2000-01-01T00:00:00.000Z",
        offer_acceptance: { status: "PENDING_ISSUER" },
      },
    };
    expect(getOfferStatus(item)).toBe("Offer expired");
    expect(shouldShowIssuerReviewOfferCta(item)).toBe(false);
  });
});

describe("getOfferStatus", () => {
  it("returns Offer received when expires_at is null", () => {
    expect(
      getOfferStatus({
        status: "OFFER_SENT",
        offer_details: { expires_at: null },
      })
    ).toBe("Offer received");
  });

  it("returns null when not OFFER_SENT", () => {
    expect(getOfferStatus({ status: "APPROVED", offer_details: { expires_at: null } })).toBe(null);
  });
});
