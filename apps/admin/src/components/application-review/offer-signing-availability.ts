/** Matches issuer-side check: signed PDF stored when offer_signing.status is signed and S3 key exists. */
export function isSignedOfferLetterAvailable(offerSigning: unknown): boolean {
  const os = offerSigning as {
    status?: string;
    signed_offer_letter_s3_key?: string;
  } | null;
  return (
    os?.status === "signed" &&
    typeof os.signed_offer_letter_s3_key === "string" &&
    os.signed_offer_letter_s3_key.length > 0
  );
}
