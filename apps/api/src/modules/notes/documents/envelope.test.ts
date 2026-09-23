import {
  DOA_SIGNING_DOCUMENT_KEY,
  FA_SIGNING_DOCUMENT_KEY,
  JSG_SIGNING_DOCUMENT_KEY,
  envelopeMatchesNoteTarget,
  pickLatestMatchingCompletedEnvelope,
  pickSignedDocumentByTemplateRef,
  signedDocumentIsAvailable,
  type NoteSigningEnvelopeLike,
} from "./envelope";

function envelope(
  overrides: Partial<NoteSigningEnvelopeLike> & Pick<NoteSigningEnvelopeLike, "id">
): NoteSigningEnvelopeLike {
  return {
    status: "COMPLETED",
    application_id: "app-1",
    contract_id: "contract-1",
    invoice_id: null,
    completed_at: "2026-09-01T00:00:00.000Z",
    documents: [],
    ...overrides,
  };
}

function doc(template_ref: string, signed = true) {
  return {
    id: `doc-${template_ref}`,
    name: template_ref,
    template_ref,
    signed_s3_key: signed ? `applications/app-1/${template_ref}.pdf` : null,
    signed_file_sha256: signed ? "abc" : null,
    status: signed ? "COMPLETED" : "PENDING",
  };
}

describe("note signing envelope scoping", () => {
  const invoiceOnlyTarget = {
    contractId: null,
    invoiceId: "invoice-1",
  };
  const contractTarget = {
    contractId: "contract-1",
    invoiceId: null,
  };
  const facilityLinkedInvoiceTarget = {
    contractId: "contract-1",
    invoiceId: "invoice-1",
    invoiceContractId: "contract-1",
  };

  it("matches invoice-only notes to the invoice envelope only", () => {
    const invoiceEnvelope = envelope({
      id: "env-invoice",
      invoice_id: "invoice-1",
      completed_at: "2026-09-02T00:00:00.000Z",
    });
    const contractEnvelope = envelope({
      id: "env-contract",
      invoice_id: null,
      completed_at: "2026-09-03T00:00:00.000Z",
    });
    expect(envelopeMatchesNoteTarget(invoiceEnvelope, invoiceOnlyTarget)).toBe(true);
    expect(envelopeMatchesNoteTarget(contractEnvelope, invoiceOnlyTarget)).toBe(false);
    expect(
      pickLatestMatchingCompletedEnvelope([contractEnvelope, invoiceEnvelope], invoiceOnlyTarget)?.id
    ).toBe("env-invoice");
  });

  it("matches facility-linked invoice notes to the contract envelope", () => {
    const invoiceEnvelope = envelope({
      id: "env-invoice",
      application_id: "invoice-app",
      invoice_id: "invoice-1",
    });
    const contractEnvelope = envelope({
      id: "env-contract",
      application_id: "facility-app",
      invoice_id: null,
    });
    expect(envelopeMatchesNoteTarget(invoiceEnvelope, facilityLinkedInvoiceTarget)).toBe(false);
    expect(envelopeMatchesNoteTarget(contractEnvelope, facilityLinkedInvoiceTarget)).toBe(true);
    expect(
      pickLatestMatchingCompletedEnvelope(
        [invoiceEnvelope, contractEnvelope],
        facilityLinkedInvoiceTarget
      )?.id
    ).toBe("env-contract");
  });

  it("matches facility notes to contract envelopes without an invoice", () => {
    const mixed = envelope({ id: "env-mixed", invoice_id: "invoice-1" });
    const contractOnly = envelope({ id: "env-contract", invoice_id: null });
    expect(envelopeMatchesNoteTarget(mixed, contractTarget)).toBe(false);
    expect(envelopeMatchesNoteTarget(contractOnly, contractTarget)).toBe(true);
  });

  it("picks the latest completed matching envelope", () => {
    const older = envelope({
      id: "env-old",
      invoice_id: "invoice-1",
      completed_at: "2026-08-01T00:00:00.000Z",
    });
    const newer = envelope({
      id: "env-new",
      invoice_id: "invoice-1",
      completed_at: "2026-09-01T00:00:00.000Z",
    });
    const draft = envelope({
      id: "env-draft",
      status: "SENT",
      invoice_id: "invoice-1",
      completed_at: "2026-09-10T00:00:00.000Z",
    });
    expect(pickLatestMatchingCompletedEnvelope([older, draft, newer], invoiceOnlyTarget)?.id).toBe(
      "env-new"
    );
  });

  it("selects signed JSG, FA, and DOA from the envelope and ignores unsigned rows", () => {
    const matching = envelope({
      id: "env-1",
      invoice_id: "invoice-1",
      documents: [
        doc(JSG_SIGNING_DOCUMENT_KEY, false),
        doc(JSG_SIGNING_DOCUMENT_KEY, true),
        doc(FA_SIGNING_DOCUMENT_KEY, true),
        doc(DOA_SIGNING_DOCUMENT_KEY, false),
      ],
    });
    const jsg = pickSignedDocumentByTemplateRef(matching, JSG_SIGNING_DOCUMENT_KEY);
    const fa = pickSignedDocumentByTemplateRef(matching, FA_SIGNING_DOCUMENT_KEY);
    const doa = pickSignedDocumentByTemplateRef(matching, DOA_SIGNING_DOCUMENT_KEY);
    expect(jsg?.signed_s3_key).toContain("guarantor_agreement");
    expect(signedDocumentIsAvailable(jsg)).toBe(true);
    expect(signedDocumentIsAvailable(fa)).toBe(true);
    expect(signedDocumentIsAvailable(doa)).toBe(false);
    expect(JSON.stringify({ id: jsg?.id, name: jsg?.name })).not.toContain("s3");
  });
});
