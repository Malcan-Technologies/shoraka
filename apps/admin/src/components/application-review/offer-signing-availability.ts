import type { SigningEnvelopeDto } from "@cashsouk/types";

/** Envelope fields needed to decide if a signed offer-letter PDF can be fetched. */
export type SignedOfferEnvelope = Pick<
  SigningEnvelopeDto,
  "status" | "contract_id" | "invoice_id" | "documents"
>;

/**
 * Same rule as admin/issuer signed-letter blob endpoints:
 * COMPLETED envelope with a GENERATED_OFFER_LETTER that has a stored signed PDF.
 * Offer status APPROVED alone is not enough (e.g. contract-linked invoices skip envelopes).
 */
function envelopeHasSignedOfferLetter(envelope: SignedOfferEnvelope): boolean {
  if (envelope.status !== "COMPLETED") return false;
  return envelope.documents.some(
    (document) => document.source === "GENERATED_OFFER_LETTER" && document.has_signed_pdf
  );
}

export function isSignedContractOfferLetterAvailable(input: {
  contractId?: string | null;
  envelopes: readonly SignedOfferEnvelope[];
}): boolean {
  const contractId = input.contractId?.trim();
  if (!contractId) return false;
  return input.envelopes.some(
    (envelope) =>
      envelope.contract_id === contractId && envelopeHasSignedOfferLetter(envelope)
  );
}

export function isSignedInvoiceOfferLetterAvailable(input: {
  invoiceId?: string | null;
  envelopes: readonly SignedOfferEnvelope[];
}): boolean {
  const invoiceId = input.invoiceId?.trim();
  if (!invoiceId) return false;
  return input.envelopes.some(
    (envelope) =>
      envelope.invoice_id === invoiceId && envelopeHasSignedOfferLetter(envelope)
  );
}
