import {
  canRejectApplication,
  canResetReviewToPending,
  canWithdrawApplication,
} from "@cashsouk/types";
import {
  canWithdrawApplicationRecord,
  resolveApplicationOriginationPhase,
} from "./origination-guards";

describe("origination-guards", () => {
  it("blocks withdraw when contract is approved", () => {
    const phase = resolveApplicationOriginationPhase({
      status: "INVOICE_PENDING",
      contract: { status: "APPROVED" },
      invoices: [{ status: "REJECTED" }],
      financing_structure: { structure_type: "new_contract" },
    });
    expect(phase).toBe("approved");
    expect(canWithdrawApplication(phase)).toBe(false);
    expect(
      canWithdrawApplicationRecord({
        status: "INVOICE_PENDING",
        contract: { status: "APPROVED" },
        invoices: [{ status: "REJECTED" }],
        financing_structure: { structure_type: "new_contract" },
      })
    ).toBe(false);
  });

  it("blocks reject when signing envelope completed", () => {
    const phase = resolveApplicationOriginationPhase({
      status: "SIGNING_PENDING",
      contract: { status: "OFFER_SENT" },
      invoices: [],
      signing_envelopes: [{ status: "COMPLETED" }],
      financing_structure: { structure_type: "new_contract" },
    });
    expect(phase).toBe("approved");
    expect(canRejectApplication(phase)).toBe(false);
  });

  it("allows reset in signing only when envelopes are draft-only", () => {
    const phase = resolveApplicationOriginationPhase({
      status: "SIGNING_PENDING",
      contract: { status: "OFFER_SENT" },
      offerAcceptanceStatus: "APPROVED_FOR_SIGNING",
      signing_envelopes: [{ status: "DRAFT" }],
    });
    expect(phase).toBe("signing");
    expect(canResetReviewToPending(phase)).toBe(false);
    expect(canResetReviewToPending(phase, { signingEnvelopesOnlyDraft: true })).toBe(true);
  });

  it("blocks reset in offerLive except offer retract paths handled by admin service", () => {
    const phase = resolveApplicationOriginationPhase({
      status: "CONTRACT_SENT",
      contract: { status: "OFFER_SENT" },
    });
    expect(phase).toBe("offerLive");
    expect(canResetReviewToPending(phase)).toBe(false);
  });
});
