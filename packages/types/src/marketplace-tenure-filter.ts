/** Marketplace and portfolio tenure filter bands for 30–180 day notes. */

export const MARKETPLACE_TENURE_FILTER_SHORT_MAX_DAYS = 60;
export const MARKETPLACE_TENURE_FILTER_MEDIUM_MAX_DAYS = 120;

export type MarketplaceTenureFilterBand = "short" | "medium" | "long";

export const MARKETPLACE_TENURE_FILTER_LABELS: Record<MarketplaceTenureFilterBand, string> = {
  short: "Up to 60 days",
  medium: "61 – 120 days",
  long: "121+ days",
};

export function marketplaceTenureFilterLabel(band: string): string | null {
  if (band === "short" || band === "medium" || band === "long") {
    return MARKETPLACE_TENURE_FILTER_LABELS[band];
  }
  return null;
}

export function matchesMarketplaceTenureFilter(
  days: number | null | undefined,
  band: string
): boolean {
  if (band === "all") return true;
  if (days == null || !Number.isFinite(days) || days < 0) return false;
  if (band === "short") return days <= MARKETPLACE_TENURE_FILTER_SHORT_MAX_DAYS;
  if (band === "medium") {
    return (
      days > MARKETPLACE_TENURE_FILTER_SHORT_MAX_DAYS &&
      days <= MARKETPLACE_TENURE_FILTER_MEDIUM_MAX_DAYS
    );
  }
  if (band === "long") return days > MARKETPLACE_TENURE_FILTER_MEDIUM_MAX_DAYS;
  return false;
}
