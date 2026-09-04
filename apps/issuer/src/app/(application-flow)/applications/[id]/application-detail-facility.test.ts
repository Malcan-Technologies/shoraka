import {
  hasIssuerFacilityOffer,
  isIssuerFacilityFinancing,
  resolveInvoiceOfferReviewContractId,
  resolveOfferReviewContractId,
} from "./application-detail-facility";

describe("application detail facility gating", () => {
  it("treats only Facility financing as a facility application", () => {
    expect(isIssuerFacilityFinancing({ type: "Facility financing" })).toBe(true);
    expect(isIssuerFacilityFinancing({ type: "Invoice financing" })).toBe(false);
    expect(isIssuerFacilityFinancing({ type: "Generic" })).toBe(false);
  });

  it("hides the facility offer panel for invoice_only even if a holder status leaked", () => {
    expect(
      hasIssuerFacilityOffer({
        type: "Invoice financing",
        contractStatus: "OFFER_SENT",
      })
    ).toBe(false);
    expect(
      hasIssuerFacilityOffer({
        type: "Facility financing",
        contractStatus: "OFFER_SENT",
      })
    ).toBe(true);
  });

  it("passes invoice offer contractId only, never an application holder fallback", () => {
    expect(resolveInvoiceOfferReviewContractId({ contractId: null })).toBeUndefined();
    expect(
      resolveOfferReviewContractId({
        offerType: "invoice",
        application: { type: "Invoice financing", contractId: "holder_ctr" },
        invoice: { contractId: null },
      })
    ).toBeUndefined();
    expect(
      resolveOfferReviewContractId({
        offerType: "invoice",
        application: { type: "Facility financing", contractId: "ctr_real" },
        invoice: { contractId: "ctr_real" },
      })
    ).toBe("ctr_real");
  });

  it("uses the application contractId only for facility offer review", () => {
    expect(
      resolveOfferReviewContractId({
        offerType: "contract",
        application: { type: "Facility financing", contractId: "ctr_real" },
        invoice: { contractId: "inv_ctr" },
      })
    ).toBe("ctr_real");
    expect(
      resolveOfferReviewContractId({
        offerType: "contract",
        application: { type: "Invoice financing", contractId: "holder_ctr" },
        invoice: null,
      })
    ).toBeUndefined();
  });
});
