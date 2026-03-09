/**
 * Derives offer status from contract or invoice for issuer UI.
 * See docs/integrations/issuer-offer-flow.md
 */
export type OfferStatus = "Offer received" | "Offer expired" | null;

export function getOfferStatus(item: {
  status?: string | null;
  offer_details?: { expires_at?: string | null } | null;
}): OfferStatus {
  if (item.status !== "SENT" || !item.offer_details) return null;

  const expiresAt = item.offer_details.expires_at;
  if (!expiresAt) return "Offer received";

  const isExpired = new Date(expiresAt) < new Date();
  return isExpired ? "Offer expired" : "Offer received";
}
