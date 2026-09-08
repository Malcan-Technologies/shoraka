import type { SigningEnvelopeDto } from "@cashsouk/types";

export {
  isSignedContractOfferLetterAvailable,
  isSignedInvoiceOfferLetterAvailable,
} from "@cashsouk/types";

/** Envelope fields needed to decide if a signed offer PDF can be fetched. */
export type SignedOfferEnvelope = Pick<
  SigningEnvelopeDto,
  "status" | "contract_id" | "invoice_id" | "documents"
>;
