import { InvoiceStatus } from "@cashsouk/types";
import { resolveSigningPackageOfferSource } from "./signing-package-offer";

const invoiceOffer = {
  offer_acceptance: {
    status: "APPROVED_FOR_SIGNING",
    authorized_parties: {
      parties: [
        {
          key: "issuer",
          entity_kind: "ISSUER",
          representatives: [{ name: "Ali", applies_company_seal: true }],
        },
      ],
    },
  },
};

const holderContractOffer = { notes: "holder only" };

describe("resolveSigningPackageOfferSource", () => {
  it("reads invoice offer details on invoice-only apps even when a holder contract_id exists", () => {
    const source = resolveSigningPackageOfferSource({
      financingStructure: { structure_type: "invoice_only" },
      contractId: "holder-contract",
      contractOfferDetails: holderContractOffer,
      invoices: [
        {
          id: "inv-1",
          status: InvoiceStatus.OFFER_SENT,
          offer_details: invoiceOffer,
        },
      ],
    });

    expect(source).toEqual({ packageKind: "invoice", offerDetails: invoiceOffer });
  });

  it("prefers the OFFER_SENT invoice when an earlier invoice has no offer", () => {
    const source = resolveSigningPackageOfferSource({
      financingStructure: { structure_type: "invoice_only" },
      contractId: "holder-contract",
      contractOfferDetails: holderContractOffer,
      invoices: [
        { id: "inv-old", status: InvoiceStatus.WITHDRAWN, offer_details: null },
        {
          id: "inv-live",
          status: InvoiceStatus.OFFER_SENT,
          offer_details: invoiceOffer,
        },
      ],
    });

    expect(source.offerDetails).toBe(invoiceOffer);
  });

  it("uses facility offer details for contract-backed applications", () => {
    const facilityOffer = { offer_acceptance: { status: "APPROVED_FOR_SIGNING" } };
    const source = resolveSigningPackageOfferSource({
      financingStructure: { structure_type: "new_contract" },
      contractId: "facility-1",
      contractOfferDetails: facilityOffer,
      invoices: [{ id: "inv-1", status: InvoiceStatus.SUBMITTED, offer_details: invoiceOffer }],
    });

    expect(source).toEqual({ packageKind: "contract", offerDetails: facilityOffer });
  });

  it("falls back to the invoice offer when there is no contract_id", () => {
    const source = resolveSigningPackageOfferSource({
      contractId: null,
      contractOfferDetails: null,
      invoices: [
        {
          id: "inv-1",
          status: InvoiceStatus.OFFER_SENT,
          offer_details: invoiceOffer,
        },
      ],
    });

    expect(source).toEqual({ packageKind: "invoice", offerDetails: invoiceOffer });
  });
});
