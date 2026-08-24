import { malaysiaCalendarDaysRemaining } from "./financing-tenure";

/** Days remaining until marketplace listing closes (`note_listings.closes_at`). */
export function resolveMarketplaceListingDaysLeft(
  listingClosesAt?: string | null
): number | null {
  if (!listingClosesAt) return null;

  const target = new Date(listingClosesAt);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const millisRemaining = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(millisRemaining / (1000 * 60 * 60 * 24)));
}

/** Malaysia calendar days from now until note maturity. Past dates clamp to 0 for filters. */
export function resolveMarketplaceDaysToMaturity(
  maturityDate?: string | null,
  now: Date = new Date()
): number | null {
  if (!maturityDate) return null;
  const remaining = malaysiaCalendarDaysRemaining(now, maturityDate);
  if (remaining == null) return null;
  return Math.max(0, remaining);
}
