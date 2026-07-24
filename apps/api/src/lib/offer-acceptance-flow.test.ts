import {
  DEFAULT_OFFER_ACKNOWLEDGEMENTS,
  buildAcknowledgedTermsSnapshot,
  isOfferAcceptanceResendBlocked,
  resolveStatusAfterOfferAcceptanceSubmit,
  workflowUsesOfferAcceptanceFlow,
} from "@cashsouk/types";
import { validateOfferAcknowledgementsConfig } from "../modules/products/validate-financial-config";
import { AppError } from "./http/error-handler";

/** Minimal financing_type step — same shape admin/issuer resolve from frozen product_version. */
function financingWorkflow(config: Record<string, unknown>) {
  return [{ id: "financing_type_1", config }];
}

describe("workflowUsesOfferAcceptanceFlow", () => {
  it("is false for missing, empty, or legacy workflow without acks/docs", () => {
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

  it("is true when offer_acknowledgements are configured", () => {
    expect(
      workflowUsesOfferAcceptanceFlow(
        financingWorkflow({
          offer_acknowledgements: [...DEFAULT_OFFER_ACKNOWLEDGEMENTS],
        })
      )
    ).toBe(true);
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

  it("is true when both acknowledgements and acceptance documents are configured", () => {
    expect(
      workflowUsesOfferAcceptanceFlow(
        financingWorkflow({
          offer_acknowledgements: [...DEFAULT_OFFER_ACKNOWLEDGEMENTS],
          acceptance_documents: [{ name: "Board Resolution", required: true }],
        })
      )
    ).toBe(true);
  });

  it("ignores empty acknowledgement / acceptance lists", () => {
    expect(
      workflowUsesOfferAcceptanceFlow(
        financingWorkflow({
          offer_acknowledgements: [],
          acceptance_documents: [],
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
          offer_acknowledgements: [...DEFAULT_OFFER_ACKNOWLEDGEMENTS],
          acceptance_documents: [{ name: "Board Resolution", required: true }],
        })
      )
    ).toBe("PENDING_ADMIN_REVIEW");
  });

  it("unlocks signing immediately for acknowledgements-only products", () => {
    expect(
      resolveStatusAfterOfferAcceptanceSubmit(
        financingWorkflow({
          offer_acknowledgements: [...DEFAULT_OFFER_ACKNOWLEDGEMENTS],
        })
      )
    ).toBe("APPROVED_FOR_SIGNING");
  });
});

describe("DEFAULT_OFFER_ACKNOWLEDGEMENTS", () => {
  it("uses generated offer letter for LOO and static text for guarantee", () => {
    const loo = DEFAULT_OFFER_ACKNOWLEDGEMENTS.find((d) => d.key === "letter_of_offer");
    const guarantee = DEFAULT_OFFER_ACKNOWLEDGEMENTS.find(
      (d) => d.key === "guarantee_acknowledgement"
    );
    expect(loo?.content_source).toBe("generated_offer_letter");
    expect(guarantee?.content_source).toBe("static_text");
  });
});

describe("isOfferAcceptanceResendBlocked", () => {
  it("allows resend when acceptance is absent or pending without acks", () => {
    expect(isOfferAcceptanceResendBlocked(null)).toBe(false);
    expect(isOfferAcceptanceResendBlocked(undefined)).toBe(false);
    expect(isOfferAcceptanceResendBlocked({ status: "PENDING_ISSUER" })).toBe(false);
  });

  it("blocks when status is past PENDING_ISSUER", () => {
    expect(isOfferAcceptanceResendBlocked({ status: "PENDING_ADMIN_REVIEW" })).toBe(true);
    expect(isOfferAcceptanceResendBlocked({ status: "APPROVED_FOR_SIGNING" })).toBe(true);
    expect(isOfferAcceptanceResendBlocked({ status: "COMPLETED" })).toBe(true);
  });

  it("blocks when acknowledgements or submitted_at exist while still PENDING_ISSUER", () => {
    expect(
      isOfferAcceptanceResendBlocked({
        status: "PENDING_ISSUER",
        acknowledgements: [
          {
            document_key: "letter_of_offer",
            accepted_at: "2026-07-21T00:00:00.000Z",
            accepted_by_user_id: "user-1",
          },
        ],
      })
    ).toBe(true);
    expect(
      isOfferAcceptanceResendBlocked({
        status: "PENDING_ISSUER",
        submitted_at: "2026-07-21T00:00:00.000Z",
      })
    ).toBe(true);
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

describe("validateOfferAcknowledgementsConfig", () => {
  it("rejects html_template placeholder sources on product save", () => {
    expect(() =>
      validateOfferAcknowledgementsConfig(
        financingWorkflow({
          offer_acknowledgements: [
            {
              key: "letter_of_offer",
              name: "Letter of Offer",
              content_source: "html_template",
              template_key: "letter_of_offer",
            },
          ],
        })
      )
    ).toThrow(AppError);

    try {
      validateOfferAcknowledgementsConfig(
        financingWorkflow({
          offer_acknowledgements: [
            {
              key: "letter_of_offer",
              name: "Letter of Offer",
              content_source: "html_template",
              template_key: "letter_of_offer",
            },
          ],
        })
      );
      throw new Error("expected validateOfferAcknowledgementsConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).toMatch(/not production-ready/i);
    }
  });

  it("accepts generated offer letter and filled static text", () => {
    expect(() =>
      validateOfferAcknowledgementsConfig(
        financingWorkflow({
          offer_acknowledgements: [
            {
              key: "letter_of_offer",
              name: "Letter of Offer",
              content_source: "generated_offer_letter",
            },
            {
              key: "guarantee_acknowledgement",
              name: "Guarantee Acknowledgement",
              content_source: "static_text",
              static_text: "I acknowledge the guarantee obligations.",
            },
          ],
        })
      )
    ).not.toThrow();
  });

  it("rejects empty static text", () => {
    expect(() =>
      validateOfferAcknowledgementsConfig(
        financingWorkflow({
          offer_acknowledgements: [
            {
              key: "guarantee_acknowledgement",
              name: "Guarantee Acknowledgement",
              content_source: "static_text",
              static_text: "   ",
            },
          ],
        })
      )
    ).toThrow(AppError);
  });
});
