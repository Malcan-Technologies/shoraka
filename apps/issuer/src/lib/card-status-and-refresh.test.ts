jest.mock("@cashsouk/config", () => ({
  getStatusPresentationByBadgeKey: () => ({ color: "bg-mock", label: "Mock" }),
  getStatusColorAndLabel: () => ({ color: "bg-mock", label: "Mock" }),
  resolveIssuerInvoiceStatusBadgeKey: (
    status: string | undefined,
    withdrawReason?: string,
    offerAcceptanceStatus?: string | null
  ) => {
    const upper = String(status ?? "").toUpperCase();
    if (upper === "OFFER_SENT" && offerAcceptanceStatus) {
      const phase = String(offerAcceptanceStatus).toUpperCase();
      const issuerMustAct = phase === "PENDING_ISSUER" || phase === "CHANGES_REQUESTED";
      const adminReviewOrSigning =
        phase === "PENDING_ADMIN_REVIEW" ||
        phase === "APPROVED_FOR_SIGNING" ||
        phase === "SIGNING_IN_PROGRESS" ||
        phase === "COMPLETED";
      if (adminReviewOrSigning && !issuerMustAct) {
        return "under_review";
      }
    }
    return String(status ?? "draft").toLowerCase();
  },
}));

import { getCardStatus, resolveNormalizedInvoiceBadgeKey } from "@/app/(application-management)/applications/status";
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

  it("shows Under Review during SIGNING_PENDING while entity stays OFFER_SENT", () => {
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

  it("shows Under Review during SIGNING_IN_PROGRESS", () => {
    const result = getCardStatus({
      applicationStatus: "SIGNING_PENDING",
      contractStatus: "OFFER_SENT",
      invoiceStatuses: [],
      offerAcceptanceStatus: "SIGNING_IN_PROGRESS",
    });
    expect(result.badgeKey).toBe("under_review");
    expect(result.showReviewOffer).toBe(false);
  });

  it("keeps Offer Received for CHANGES_REQUESTED (issuer must re-submit)", () => {
    const result = getCardStatus({
      applicationStatus: "CONTRACT_SENT",
      contractStatus: "OFFER_SENT",
      invoiceStatuses: [],
      offerAcceptanceStatus: "CHANGES_REQUESTED",
    });
    expect(result.badgeKey).toBe("offer_sent");
    expect(result.showReviewOffer).toBe(true);
  });

  it("shows Under Review for invoice-only signing phase", () => {
    const result = getCardStatus({
      applicationStatus: "SIGNING_PENDING",
      contractStatus: null,
      invoiceStatuses: ["OFFER_SENT"],
      offerAcceptanceStatus: "SIGNING_IN_PROGRESS",
    });
    expect(result.badgeKey).toBe("under_review");
    expect(result.showReviewOffer).toBe(false);
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

  it("falls back to application offerAcceptanceStatus for OFFER_SENT rows", () => {
    expect(
      resolveNormalizedInvoiceBadgeKey(
        {
          id: "inv-1",
          status: "OFFER_SENT",
        } as import("@/app/(application-management)/applications/status").NormalizedInvoice,
        { offerAcceptanceStatus: "SIGNING_IN_PROGRESS" }
      )
    ).toBe("under_review");
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
