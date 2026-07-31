import {
  isSignedContractOfferLetterAvailable,
  isSignedInvoiceOfferLetterAvailable,
  type SignedOfferEnvelope,
} from "./offer-signing-availability";

function envelope(partial: Partial<SignedOfferEnvelope> & Pick<SignedOfferEnvelope, "status">): SignedOfferEnvelope {
  return {
    contract_id: null,
    invoice_id: null,
    documents: [],
    ...partial,
  };
}

describe("offer-signing-availability", () => {
  it("returns false for APPROVED-only offers with no completed envelope", () => {
    expect(
      isSignedContractOfferLetterAvailable({
        contractId: "c1",
        envelopes: [],
      })
    ).toBe(false);
    expect(
      isSignedInvoiceOfferLetterAvailable({
        invoiceId: "i1",
        envelopes: [],
      })
    ).toBe(false);
  });

  it("returns true when a completed envelope has a signed offer letter PDF", () => {
    const completed = envelope({
      status: "COMPLETED",
      contract_id: "c1",
      documents: [
        {
          id: "d1",
          name: "Offer",
          description: null,
          source: "GENERATED_OFFER_LETTER",
          order: 0,
          required: true,
          status: "SIGNED",
          has_signed_pdf: true,
        },
      ],
    });
    expect(
      isSignedContractOfferLetterAvailable({ contractId: "c1", envelopes: [completed] })
    ).toBe(true);
  });

  it("ignores incomplete envelopes and envelopes without a signed offer PDF", () => {
    const envelopes: SignedOfferEnvelope[] = [
      envelope({
        status: "SENT",
        invoice_id: "i1",
        documents: [
          {
            id: "d1",
            name: "Offer",
            description: null,
            source: "GENERATED_OFFER_LETTER",
            order: 0,
            required: true,
            status: "PENDING",
            has_signed_pdf: false,
          },
        ],
      }),
      envelope({
        status: "COMPLETED",
        invoice_id: "i1",
        documents: [
          {
            id: "d2",
            name: "Guarantee",
            description: null,
            source: "TEMPLATE",
            order: 0,
            required: true,
            status: "SIGNED",
            has_signed_pdf: true,
          },
        ],
      }),
    ];
    expect(isSignedInvoiceOfferLetterAvailable({ invoiceId: "i1", envelopes })).toBe(false);
  });

  it("scopes contract vs invoice envelopes by their linked ids", () => {
    const envelopes: SignedOfferEnvelope[] = [
      envelope({
        status: "COMPLETED",
        contract_id: "c1",
        documents: [
          {
            id: "d1",
            name: "Offer",
            description: null,
            source: "GENERATED_OFFER_LETTER",
            order: 0,
            required: true,
            status: "SIGNED",
            has_signed_pdf: true,
          },
        ],
      }),
      envelope({
        status: "COMPLETED",
        invoice_id: "i2",
        contract_id: "c1",
        documents: [
          {
            id: "d2",
            name: "Offer",
            description: null,
            source: "GENERATED_OFFER_LETTER",
            order: 0,
            required: true,
            status: "SIGNED",
            has_signed_pdf: true,
          },
        ],
      }),
    ];
    expect(isSignedContractOfferLetterAvailable({ contractId: "c1", envelopes })).toBe(true);
    expect(isSignedInvoiceOfferLetterAvailable({ invoiceId: "i1", envelopes })).toBe(false);
    expect(isSignedInvoiceOfferLetterAvailable({ invoiceId: "i2", envelopes })).toBe(true);
  });
});
