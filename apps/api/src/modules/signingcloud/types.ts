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

/**
 * One superseded signed offer stored in offer_signing_history (Json array).
 */
export interface ArchivedOfferSigningRecord {
  provider: OfferSigningProvider;
  status: "signed";
  signer_email: string;
  signed_offer_letter_s3_key: string;
  signed_file_sha256?: string;
  completed_at: string;
  initiated_by_user_id?: string;
  /** offer_details.version at time of archive */
  offer_version?: number;
  archived_at: string;
  archived_by_user_id: string;
  archive_reason: "admin_resign";
}

/** Admin-facing summary of active or archived signing state */
export interface OfferSigningSummary {
  status: OfferSigningStatus | "archived";
  signerEmail: string | null;
  signedOfferLetterS3Key: string | null;
  completedAt: string | null;
  offerVersion: number | null;
}

export function isSignedOfferSigningRecord(value: unknown): value is OfferSigningRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const os = value as OfferSigningRecord;
  return (
    os.status === "signed" &&
    typeof os.signed_offer_letter_s3_key === "string" &&
    os.signed_offer_letter_s3_key.trim().length > 0
  );
}

export function parseOfferSigningHistory(raw: unknown): ArchivedOfferSigningRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is ArchivedOfferSigningRecord => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const r = entry as ArchivedOfferSigningRecord;
    return (
      r.status === "signed" &&
      typeof r.signed_offer_letter_s3_key === "string" &&
      r.signed_offer_letter_s3_key.trim().length > 0 &&
      typeof r.archived_at === "string"
    );
  });
}

export function mapActiveOfferSigningSummary(
  offerSigning: unknown,
  offerDetails: Record<string, unknown> | null
): OfferSigningSummary | null {
  if (!isSignedOfferSigningRecord(offerSigning)) return null;
  const os = offerSigning as OfferSigningRecord;
  const version =
    typeof offerDetails?.version === "number" && Number.isFinite(offerDetails.version)
      ? offerDetails.version
      : null;
  return {
    status: "signed",
    signerEmail: os.signer_email ?? null,
    signedOfferLetterS3Key: os.signed_offer_letter_s3_key ?? null,
    completedAt: os.completed_at ?? null,
    offerVersion: version,
  };
}

export function mapArchivedOfferSigningSummaries(
  history: unknown
): OfferSigningSummary[] {
  return parseOfferSigningHistory(history).map((entry) => ({
    status: "archived" as const,
    signerEmail: entry.signer_email ?? null,
    signedOfferLetterS3Key: entry.signed_offer_letter_s3_key,
    completedAt: entry.completed_at ?? null,
    offerVersion:
      typeof entry.offer_version === "number" && Number.isFinite(entry.offer_version)
        ? entry.offer_version
        : null,
  }));
}
