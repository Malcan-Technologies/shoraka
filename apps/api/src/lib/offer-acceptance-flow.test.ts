import {
  DEFAULT_OFFER_ACKNOWLEDGEMENTS,
  resolveStatusAfterOfferAcceptanceSubmit,
  workflowUsesOfferAcceptanceFlow,
} from "@cashsouk/types";

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
