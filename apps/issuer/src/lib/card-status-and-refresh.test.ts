jest.mock("@cashsouk/config", () => ({
  getStatusPresentationByBadgeKey: () => ({ color: "bg-mock", label: "Mock" }),
  getStatusColorAndLabel: () => ({ color: "bg-mock", label: "Mock" }),
  resolveIssuerInvoiceStatusBadgeKey: (status: string) => String(status ?? "").toLowerCase(),
}));

import { getCardStatus } from "@/app/(application-management)/applications/status";
import {
  getLiveSigningEnvelopeRefetchInterval,
  getReviewDetailRefreshPolicy,
  getReviewListRefreshPolicy,
} from "../../../../packages/config/src/review-refresh-policy";

describe("getCardStatus offer awaiting review", () => {
  it("shows Under Review when acceptance is PENDING_ADMIN_REVIEW", () => {
    const result = getCardStatus({
      applicationStatus: "CONTRACT_SENT",
      contractStatus: "OFFER_SENT",
      invoiceStatuses: [],
      offerAcceptanceStatus: "PENDING_ADMIN_REVIEW",
    });
    expect(result.badgeKey).toBe("under_review");
    expect(result.displayLabel).toBe("Under Review");
    expect(result.showReviewOffer).toBe(false);
  });

  it("keeps Offer Received for PENDING_ISSUER", () => {
    const result = getCardStatus({
      applicationStatus: "CONTRACT_SENT",
      contractStatus: "OFFER_SENT",
      invoiceStatuses: [],
      offerAcceptanceStatus: "PENDING_ISSUER",
    });
    expect(result.badgeKey).toBe("offer_sent");
    expect(result.showReviewOffer).toBe(true);
  });
});

describe("review refresh policies", () => {
  it("keeps detail polling at 15s and list at 60s", () => {
    expect(getReviewDetailRefreshPolicy().refetchInterval).toBe(15_000);
    expect(getReviewListRefreshPolicy().refetchInterval).toBe(60_000);
  });

  it("polls signing envelopes only while SENT or IN_PROGRESS", () => {
    expect(getLiveSigningEnvelopeRefetchInterval([{ status: "DRAFT" }])).toBe(false);
    expect(getLiveSigningEnvelopeRefetchInterval([{ status: "COMPLETED" }])).toBe(false);
    expect(getLiveSigningEnvelopeRefetchInterval([{ status: "SENT" }])).toBe(15_000);
    expect(getLiveSigningEnvelopeRefetchInterval([{ status: "IN_PROGRESS" }])).toBe(15_000);
    expect(
      getLiveSigningEnvelopeRefetchInterval([{ status: "DRAFT" }, { status: "SENT" }])
    ).toBe(15_000);
  });
});
