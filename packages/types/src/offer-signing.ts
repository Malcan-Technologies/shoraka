export type OfferSigningDisplayStatus = "pending" | "signed" | "failed" | "archived";

export interface OfferSigningSummary {
  status: OfferSigningDisplayStatus;
  signerEmail: string | null;
  signedOfferLetterS3Key: string | null;
  completedAt: string | null;
  offerVersion: number | null;
  archivedAt?: string | null;
}

export interface OfferSigningAdminView {
  activeSignedOffer: OfferSigningSummary | null;
  archivedSignedOffers: OfferSigningSummary[];
  canResign: boolean;
  primaryApplicationId: string | null;
}
