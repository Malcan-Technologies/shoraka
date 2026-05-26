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

/** Calendar days from now until note maturity. */
export function resolveMarketplaceDaysToMaturity(
  maturityDate?: string | null
): number | null {
  if (!maturityDate) return null;

  const target = new Date(maturityDate);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const millisRemaining = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(millisRemaining / (1000 * 60 * 60 * 24)));
}
