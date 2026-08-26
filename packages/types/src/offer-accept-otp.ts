import type { UtilisationOfferConsentId } from "./utilisation-offer-terms";

export const OFFER_ACCEPT_SIGNATORY_SOURCES = ["FACILITY_ENVELOPE", "ORG_DIRECTOR"] as const;

export type OfferAcceptSignatorySource = (typeof OFFER_ACCEPT_SIGNATORY_SOURCES)[number];

export type InvoiceOfferAcceptSignatory = {
  name: string;
  email: string;
  source: OfferAcceptSignatorySource;
};

export type InvoiceOfferAcceptSignatoriesResponse = {
  source: OfferAcceptSignatorySource;
  signatories: InvoiceOfferAcceptSignatory[];
};

export type InvoiceOfferAcceptOtpRequestInput = {
  signatory_email: string;
};

export type InvoiceOfferAcceptOtpRequestResponse = {
  challenge_id: string;
  expires_at: string;
  last_sent_at: string;
  resend_available_at: string;
  remaining_sends: number;
  remaining_attempts: number;
};

export type InvoiceOfferAcceptInput = {
  challenge_id: string;
  otp_code: string;
  consent_ids: UtilisationOfferConsentId[];
};

export type InvoiceOfferAcceptedSignatory = InvoiceOfferAcceptSignatory & {
  verified_at: string;
};
