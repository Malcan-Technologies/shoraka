import {
  buildAcknowledgedTermsSnapshot,
  isOfferAcceptanceDocumentsVisibleToAdmin,
  isOfferAcceptanceResendBlocked,
  resolveStatusAfterOfferAcceptanceSubmit,
  workflowUsesOfferAcceptanceFlow,
} from "@cashsouk/types";

/** Minimal financing_type step — same shape admin/issuer resolve from frozen product_version. */
function financingWorkflow(config: Record<string, unknown>) {
  return [{ id: "financing_type_1", config }];
}

describe("workflowUsesOfferAcceptanceFlow", () => {
  it("is false for missing, empty, or legacy workflow without acceptance docs", () => {
    expect(workflowUsesOfferAcceptanceFlow(undefined)).toBe(false);
    expect(workflowUsesOfferAcceptanceFlow(null)).toBe(false);
    expect(workflowUsesOfferAcceptanceFlow([])).toBe(false);
    expect(
      workflowUsesOfferAcceptanceFlow(
        financingWorkflow({
          signing_packages: { documents: [{ key: "facility_agreement", name: "Facility Agreement" }] },
        })
      )
    ).toBe(false);
  });

  it("is true when acceptance_documents are configured", () => {
    expect(
      workflowUsesOfferAcceptanceFlow(
        financingWorkflow({
          acceptance_documents: [{ name: "Board Resolution", required: true }],
        })
      )
    ).toBe(true);
  });

  it("ignores empty acceptance_documents list", () => {
    expect(
      workflowUsesOfferAcceptanceFlow(
        financingWorkflow({
          acceptance_documents: [],
        })
      )
    ).toBe(false);
  });

  it("ignores stale offer_acknowledgements without acceptance_documents", () => {
    expect(
      workflowUsesOfferAcceptanceFlow(
        financingWorkflow({
          offer_acknowledgements: [
            { key: "letter_of_offer", name: "Letter of Offer", content_source: "generated_offer_letter" },
          ],
        })
      )
    ).toBe(false);
  });
});

describe("resolveStatusAfterOfferAcceptanceSubmit", () => {
  it("waits for admin when acceptance documents exist", () => {
    expect(
      resolveStatusAfterOfferAcceptanceSubmit(
        financingWorkflow({
          acceptance_documents: [{ name: "Board Resolution", required: true }],
        })
      )
    ).toBe("PENDING_ADMIN_REVIEW");
  });

  it("unlocks signing immediately when no acceptance documents configured", () => {
    expect(resolveStatusAfterOfferAcceptanceSubmit(financingWorkflow({}))).toBe(
      "APPROVED_FOR_SIGNING"
    );
  });
});

describe("isOfferAcceptanceResendBlocked", () => {
  it("allows resend when acceptance is absent or pending without submitted_at", () => {
    expect(isOfferAcceptanceResendBlocked(null)).toBe(false);
    expect(isOfferAcceptanceResendBlocked(undefined)).toBe(false);
    expect(isOfferAcceptanceResendBlocked({ status: "PENDING_ISSUER" })).toBe(false);
  });

  it("blocks when status is past PENDING_ISSUER", () => {
    expect(isOfferAcceptanceResendBlocked({ status: "PENDING_ADMIN_REVIEW" })).toBe(true);
    expect(isOfferAcceptanceResendBlocked({ status: "APPROVED_FOR_SIGNING" })).toBe(true);
    expect(isOfferAcceptanceResendBlocked({ status: "COMPLETED" })).toBe(true);
  });

  it("blocks when submitted_at exists while still PENDING_ISSUER", () => {
    expect(
      isOfferAcceptanceResendBlocked({
        status: "PENDING_ISSUER",
        submitted_at: "2026-07-21T00:00:00.000Z",
      })
    ).toBe(true);
  });
});

describe("isOfferAcceptanceDocumentsVisibleToAdmin", () => {
  it("hides docs while PENDING_ISSUER even if uploads exist elsewhere", () => {
    expect(isOfferAcceptanceDocumentsVisibleToAdmin(null)).toBe(false);
    expect(isOfferAcceptanceDocumentsVisibleToAdmin({ status: "PENDING_ISSUER" })).toBe(false);
  });

  it("shows docs after submitted_at or post-submit phases", () => {
    expect(
      isOfferAcceptanceDocumentsVisibleToAdmin({
        status: "PENDING_ISSUER",
        submitted_at: "2026-07-21T00:00:00.000Z",
      })
    ).toBe(true);
    expect(isOfferAcceptanceDocumentsVisibleToAdmin({ status: "PENDING_ADMIN_REVIEW" })).toBe(true);
    expect(isOfferAcceptanceDocumentsVisibleToAdmin({ status: "CHANGES_REQUESTED" })).toBe(true);
    expect(isOfferAcceptanceDocumentsVisibleToAdmin({ status: "APPROVED_FOR_SIGNING" })).toBe(true);
  });
});

describe("buildAcknowledgedTermsSnapshot", () => {
  it("copies contract commercial fields for audit", () => {
    expect(
      buildAcknowledgedTermsSnapshot({
        offerDetails: {
          version: 2,
          offered_facility: 500000,
          facility_fee_rate_percent: 1.5,
          offer_acceptance: {
            status: "PENDING_ISSUER",
            acceptance_expires_at: "2026-08-01T00:00:00.000Z",
          },
        },
        productVersion: 3,
      })
    ).toEqual({
      offer_version: 2,
      product_version: 3,
      expires_at: "2026-08-01T00:00:00.000Z",
      offered_facility: 500000,
      facility_fee_rate_percent: 1.5,
    });
  });

  it("copies invoice commercial fields for audit", () => {
    expect(
      buildAcknowledgedTermsSnapshot({
        offerDetails: {
          version: 1,
          offered_amount: 100000,
          offered_ratio_percent: 80,
          offered_profit_rate_percent: 6,
          platform_fee_rate_percent: 1,
          risk_rating: "B",
          expires_at: null,
        },
        productVersion: null,
      })
    ).toEqual({
      offer_version: 1,
      product_version: null,
      expires_at: null,
      offered_amount: 100000,
      offered_ratio_percent: 80,
      offered_profit_rate_percent: 6,
      platform_fee_rate_percent: 1,
      risk_rating: "B",
    });
  });
});
