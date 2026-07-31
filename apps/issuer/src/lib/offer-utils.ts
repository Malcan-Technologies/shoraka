/**
 * Derives offer status from contract or invoice for issuer UI.
 * See docs/integrations/issuer-offer-flow.md
 *
 * Phase deadline display helpers live in @cashsouk/types (shared with admin).
 */
import {
  formatPhaseDeadline as formatPhaseDeadlineShared,
  getOfferAcceptanceFromOfferDetails,
  getOfferPhaseDeadlineDisplay as getOfferPhaseDeadlineDisplayShared,
  getPhaseDeadlineUrgency as getPhaseDeadlineUrgencyShared,
  isPhaseDeadlineExpired,
  PHASE_DEADLINE_SOON_DAYS as PHASE_DEADLINE_SOON_DAYS_SHARED,
  phaseDeadlineLabel as phaseDeadlineLabelShared,
  offerAcceptanceAllowsIssuerReviewCta,
  resolveActiveOfferDeadlineIso,
  type OfferPhaseDeadlineDisplay,
  type PhaseDeadlineUrgency,
} from "@cashsouk/types";

export type OfferStatus = "Offer received" | "Offer expired" | null;

export type { OfferPhaseDeadlineDisplay, PhaseDeadlineUrgency };

export const PHASE_DEADLINE_SOON_DAYS = PHASE_DEADLINE_SOON_DAYS_SHARED;
export const phaseDeadlineLabel = phaseDeadlineLabelShared;
export const formatPhaseDeadline = formatPhaseDeadlineShared;
export const getPhaseDeadlineUrgency = getPhaseDeadlineUrgencyShared;
export const getOfferPhaseDeadlineDisplay = getOfferPhaseDeadlineDisplayShared;

export function getOfferStatus(item: {
  status?: string | null;
  offer_details?: unknown;
}): OfferStatus {
  if (!item.offer_details) return null;
  const status = String(item.status ?? "").toUpperCase();
  if (status === "OFFER_EXPIRED") return "Offer expired";
  if (status !== "OFFER_SENT") return null;

  const acceptance = getOfferAcceptanceFromOfferDetails(item.offer_details);
  const expiresAt = resolveActiveOfferDeadlineIso(acceptance);
  if (!expiresAt) return "Offer received";

  const isExpired = isPhaseDeadlineExpired(expiresAt);
  return isExpired ? "Offer expired" : "Offer received";
}

/** Review Offer CTA: offer received (not expired) and not waiting on admin acceptance review. */
export function shouldShowIssuerReviewOfferCta(item: {
  status?: string | null;
  offer_details?: unknown;
}): boolean {
  if (getOfferStatus(item) !== "Offer received") {
    return false;
  }
  const status = getOfferAcceptanceFromOfferDetails(item.offer_details)?.status ?? null;
  return offerAcceptanceAllowsIssuerReviewCta(status);
}
