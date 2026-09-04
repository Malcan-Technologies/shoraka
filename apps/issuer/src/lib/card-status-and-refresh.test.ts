jest.mock("@cashsouk/config", () => ({
  getStatusPresentationByBadgeKey: () => ({ color: "bg-mock", label: "Mock" }),
  getStatusColorAndLabel: () => ({ color: "bg-mock", label: "Mock" }),
  resolveIssuerInvoiceStatusBadgeKey: (
    status: string | undefined,
    _withdrawReason?: string,
    offerAcceptanceStatus?: string | null
  ) => {
    const upper = String(status ?? "").toUpperCase();
    if (upper === "OFFER_SENT" && offerAcceptanceStatus) {
      const phase = String(offerAcceptanceStatus).toUpperCase();
      if (phase === "PENDING_ADMIN_REVIEW" || phase === "APPROVED_FOR_SIGNING" || phase === "COMPLETED") {
        return "under_review";
      }
    }
    return String(status ?? "draft").toLowerCase();
  },
}));

import {
  countPendingIssuerOfferReviewItems,
  getCardStatus,
  resolveNormalizedInvoiceBadgeKey,
  type NormalizedApplication,
} from "@/app/(application-management)/applications/status";
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

  it("shows Under Review while waiting for CashSouk to send signing links", () => {
    const result = getCardStatus({
      applicationStatus: "SIGNING_PENDING",
      contractStatus: "OFFER_SENT",
      invoiceStatuses: [],
      offerAcceptanceStatus: "APPROVED_FOR_SIGNING",
    });
    expect(result.badgeKey).toBe("under_review");
    expect(result.displayLabel).toBe("Under Review");
    expect(result.showReviewOffer).toBe(false);
  });

  it("shows Offer Received + Review Offer during SIGNING_IN_PROGRESS", () => {
    const result = getCardStatus({
      applicationStatus: "SIGNING_PENDING",
      contractStatus: "OFFER_SENT",
      invoiceStatuses: [],
      offerAcceptanceStatus: "SIGNING_IN_PROGRESS",
    });
    expect(result.badgeKey).toBe("offer_sent");
    expect(result.showReviewOffer).toBe(true);
  });

  it("shows Changes Requested for CHANGES_REQUESTED (issuer must re-submit)", () => {
    const result = getCardStatus({
      applicationStatus: "CONTRACT_SENT",
      contractStatus: "OFFER_SENT",
      invoiceStatuses: [],
      offerAcceptanceStatus: "CHANGES_REQUESTED",
    });
    expect(result.badgeKey).toBe("offer_sent");
    expect(result.displayLabel).toBe("Changes Requested");
    expect(result.showReviewOffer).toBe(true);
  });

  it("shows card Review Offer for invoice-only signing", () => {
    const result = getCardStatus({
      applicationStatus: "SIGNING_PENDING",
      contractStatus: null,
      invoiceStatuses: ["OFFER_SENT"],
      offerAcceptanceStatus: "SIGNING_IN_PROGRESS",
    });
    expect(result.badgeKey).toBe("offer_sent");
    expect(result.showReviewOffer).toBe(true);
  });

  it("does not count a leftover holder OFFER_SENT on invoice financing", () => {
    const count = countPendingIssuerOfferReviewItems({
      type: "Invoice financing",
      contractId: "holder_ctr",
      contractStatus: "OFFER_SENT",
      cardStatus: {
        badgeKey: "offer_sent",
        displayLabel: "Offer Received",
        showReviewOffer: true,
        showMakeAmendments: false,
      },
      invoices: [
        {
          id: "inv_1",
          status: "OFFER_SENT",
          canReviewOffer: true,
        },
      ],
    } as NormalizedApplication);
    expect(count).toBe(1);
  });
});

describe("resolveNormalizedInvoiceBadgeKey", () => {
  it("shows under_review when OFFER_SENT and acceptance is PENDING_ADMIN_REVIEW", () => {
    expect(
      resolveNormalizedInvoiceBadgeKey({
        id: "inv-1",
        status: "OFFER_SENT",
        offerAcceptanceStatus: "PENDING_ADMIN_REVIEW",
      } as import("@/app/(application-management)/applications/status").NormalizedInvoice)
    ).toBe("under_review");
  });

  it("keeps offer_sent when acceptance is PENDING_ISSUER", () => {
    expect(
      resolveNormalizedInvoiceBadgeKey({
        id: "inv-1",
        status: "OFFER_SENT",
        offerAcceptanceStatus: "PENDING_ISSUER",
      } as import("@/app/(application-management)/applications/status").NormalizedInvoice)
    ).toBe("offer_sent");
  });

  it("keeps offer_sent for OFFER_SENT rows during signing phases", () => {
    expect(
      resolveNormalizedInvoiceBadgeKey(
        {
          id: "inv-1",
          status: "OFFER_SENT",
        } as import("@/app/(application-management)/applications/status").NormalizedInvoice,
        { offerAcceptanceStatus: "SIGNING_IN_PROGRESS" }
      )
    ).toBe("offer_sent");
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
