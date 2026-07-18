/**
 * Helpers for offer_details.offer_acceptance phase updates.
 */

import {
  createInitialOfferAcceptanceDetails,
  getOfferAcceptanceFromOfferDetails,
  parseOfferAcceptanceDetails,
  withOfferAcceptance,
  type OfferAcceptanceDetails,
  type OfferAcceptanceStatus,
  type OfferAcknowledgementRecord,
} from "@cashsouk/types";

export function ensureOfferAcceptanceOnSend(
  offerDetails: Record<string, unknown>
): Record<string, unknown> {
  const existing = getOfferAcceptanceFromOfferDetails(offerDetails);
  if (existing) return offerDetails;
  return withOfferAcceptance(offerDetails, createInitialOfferAcceptanceDetails());
}

export function patchOfferAcceptance(
  offerDetails: Record<string, unknown>,
  patch: Partial<OfferAcceptanceDetails> & { status: OfferAcceptanceStatus }
): Record<string, unknown> {
  const current =
    parseOfferAcceptanceDetails(offerDetails.offer_acceptance) ?? createInitialOfferAcceptanceDetails();
  return withOfferAcceptance(offerDetails, { ...current, ...patch });
}

export function buildAcknowledgementRecords(input: {
  documentKeys: string[];
  userId: string;
  acceptedAt: string;
}): OfferAcknowledgementRecord[] {
  return input.documentKeys.map((document_key) => ({
    document_key,
    accepted_at: input.acceptedAt,
    accepted_by_user_id: input.userId,
  }));
}
