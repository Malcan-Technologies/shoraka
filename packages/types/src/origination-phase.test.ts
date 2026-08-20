import { ApplicationStatus } from "./index";
import {
  buildOriginationPhaseInput,
  canArchiveApplication,
  canRejectApplication,
  canResetReviewToPending,
  canWithdrawApplication,
  isCompletedWithNoApprovedInvoices,
  resolveOriginationPhase,
} from "./origination-phase";

describe("resolveOriginationPhase", () => {
  it("returns draft for DRAFT", () => {
    expect(
      resolveOriginationPhase({ applicationStatus: ApplicationStatus.DRAFT })
    ).toBe("draft");
  });

  it("returns closed for terminal application statuses", () => {
    for (const status of [
      ApplicationStatus.COMPLETED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
      ApplicationStatus.ARCHIVED,
    ]) {
      expect(resolveOriginationPhase({ applicationStatus: status })).toBe("closed");
    }
  });

  it("returns amendment for AMENDMENT_REQUESTED", () => {
    expect(
      resolveOriginationPhase({ applicationStatus: ApplicationStatus.AMENDMENT_REQUESTED })
    ).toBe("amendment");
  });

  it("returns expired for OFFER_EXPIRED application status", () => {
    expect(
      resolveOriginationPhase({ applicationStatus: ApplicationStatus.OFFER_EXPIRED })
    ).toBe("expired");
  });

  it("returns approved when contract is APPROVED", () => {
    expect(
      resolveOriginationPhase({
        applicationStatus: ApplicationStatus.INVOICE_PENDING,
        contractStatus: "APPROVED",
      })
    ).toBe("approved");
  });

  it("returns approved when signing envelope is COMPLETED", () => {
    expect(
      resolveOriginationPhase({
        applicationStatus: ApplicationStatus.SIGNING_PENDING,
        contractStatus: "OFFER_SENT",
        signingEnvelopeStatuses: ["COMPLETED"],
      })
    ).toBe("approved");
  });

  it("returns signing for acceptance ceremony statuses", () => {
    expect(
      resolveOriginationPhase({
        applicationStatus: ApplicationStatus.CONTRACT_ACCEPTED,
        contractStatus: "OFFER_SENT",
      })
    ).toBe("signing");
    expect(
      resolveOriginationPhase({
        applicationStatus: ApplicationStatus.CONTRACT_SENT,
        offerAcceptanceStatus: "APPROVED_FOR_SIGNING",
      })
    ).toBe("signing");
  });

  it("returns offerLive for sent offers", () => {
    expect(
      resolveOriginationPhase({
        applicationStatus: ApplicationStatus.CONTRACT_SENT,
        contractStatus: "OFFER_SENT",
      })
    ).toBe("offerLive");
    expect(
      resolveOriginationPhase({
        applicationStatus: ApplicationStatus.INVOICES_SENT,
        invoiceStatuses: ["OFFER_SENT"],
      })
    ).toBe("offerLive");
  });

  it("returns underReview for submitted queue", () => {
    expect(
      resolveOriginationPhase({
        applicationStatus: ApplicationStatus.SUBMITTED,
        contractStatus: "SUBMITTED",
      })
    ).toBe("underReview");
  });

  it("returns closed for unrecognized application statuses (fail closed)", () => {
    expect(resolveOriginationPhase({ applicationStatus: "FUNDED" })).toBe("closed");
    expect(resolveOriginationPhase({ applicationStatus: "MYSTERY_STATUS" })).toBe("closed");
  });
});

describe("origination phase action matrix", () => {
  const phases = [
    "draft",
    "underReview",
    "amendment",
    "offerLive",
    "signing",
    "approved",
    "closed",
    "expired",
  ] as const;

  it("withdraw allowed until approved/closed/draft", () => {
    expect(phases.filter(canWithdrawApplication)).toEqual([
      "underReview",
      "amendment",
      "offerLive",
      "signing",
      "expired",
    ]);
  });

  it("archive allowed only for draft and closed", () => {
    expect(phases.filter((phase) => canArchiveApplication(phase))).toEqual(["draft", "closed"]);
    expect(canArchiveApplication("closed", { alreadyArchived: true })).toBe(false);
  });

  it("unknown status denies withdraw, reject, and reset", () => {
    const unknownPhase = resolveOriginationPhase({ applicationStatus: "FUNDED" });
    expect(unknownPhase).toBe("closed");
    expect(canWithdrawApplication(unknownPhase)).toBe(false);
    expect(canRejectApplication(unknownPhase)).toBe(false);
    expect(canResetReviewToPending(unknownPhase)).toBe(false);
  });

  it("reject allowed until approved", () => {
    expect(phases.filter(canRejectApplication)).toEqual([
      "underReview",
      "amendment",
      "offerLive",
      "signing",
      "expired",
    ]);
  });

  it("reset to pending only in underReview/amendment, or signing with draft-only envelopes", () => {
    expect(canResetReviewToPending("underReview")).toBe(true);
    expect(canResetReviewToPending("amendment")).toBe(true);
    expect(canResetReviewToPending("offerLive")).toBe(false);
    expect(canResetReviewToPending("signing")).toBe(false);
    expect(
      canResetReviewToPending("signing", { signingEnvelopesOnlyDraft: true })
    ).toBe(true);
    expect(canResetReviewToPending("approved")).toBe(false);
  });
});

describe("buildOriginationPhaseInput", () => {
  it("normalizes nested entity statuses", () => {
    const input = buildOriginationPhaseInput({
      applicationStatus: "submitted",
      contract: { status: "offer_sent" },
      invoices: [{ status: "draft" }],
      signingEnvelopes: [{ status: "draft" }],
    });
    expect(input.contractStatus).toBe("OFFER_SENT");
    expect(input.invoiceStatuses).toEqual(["DRAFT"]);
  });
});

describe("isCompletedWithNoApprovedInvoices", () => {
  it("is false for contract-only COMPLETED", () => {
    expect(isCompletedWithNoApprovedInvoices("COMPLETED", [])).toBe(false);
  });

  it("is true when all invoices are non-approved", () => {
    expect(isCompletedWithNoApprovedInvoices("COMPLETED", ["REJECTED", "WITHDRAWN"])).toBe(
      true
    );
  });

  it("is false when at least one invoice is approved", () => {
    expect(isCompletedWithNoApprovedInvoices("COMPLETED", ["APPROVED", "REJECTED"])).toBe(
      false
    );
  });
});
