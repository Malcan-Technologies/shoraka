export type OfferSigningProvider = "signingcloud";

export type OfferSigningStatus = "pending" | "signed" | "failed";

/**
 * Persisted on Contract.offer_signing / Invoice.offer_signing (Json).
 */
export interface OfferSigningRecord {
  provider: OfferSigningProvider;
  status: OfferSigningStatus;
  initiated_at: string;
  initiated_by_user_id: string;
  signer_email: string;
  /** Last known manual-signing / preview URL (optional) */
  signing_url?: string;
  /** Issuer redirect after signing (same URL sent to SigningCloud) */
  return_url?: string;
  signed_offer_letter_s3_key?: string;
  signed_file_sha256?: string;
  completed_at?: string;
  last_error?: string;
}
