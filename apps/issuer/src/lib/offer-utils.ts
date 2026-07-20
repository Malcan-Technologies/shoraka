/**
 * Derives offer status from contract or invoice for issuer UI.
 * See docs/integrations/issuer-offer-flow.md
 */
import {
  getOfferAcceptanceFromOfferDetails,
  offerAcceptanceAllowsIssuerReviewCta,
} from "@cashsouk/types";

export type OfferStatus = "Offer received" | null;

export function getOfferStatus(item: {
  status?: string | null;
  offer_details?: { expires_at?: string | null } | null;
}): OfferStatus {
  if (item.status !== "OFFER_SENT" || !item.offer_details) return null;

  return "Offer received";
}

/** Review Offer CTA: offer received and not waiting on admin acceptance review. */
export function shouldShowIssuerReviewOfferCta(item: {
  status?: string | null;
  offer_details?: unknown;
}): boolean {
  if (getOfferStatus(item as { status?: string | null; offer_details?: { expires_at?: string | null } | null }) !== "Offer received") {
    return false;
  }
  const status = getOfferAcceptanceFromOfferDetails(item.offer_details)?.status ?? null;
  return offerAcceptanceAllowsIssuerReviewCta(status);
}
