/**
 * SECTION: SoukScore manual risk grade on invoice offers
 * WHY: Admin financial review invoice offers; stored on invoices.offer_details
 * INPUT: API body or JSON risk_rating string
 * OUTPUT: Typed grade or type guard false
 * WHERE USED: Admin send-invoice-offer API, admin invoice review UI
 */

export const SOUKSCORE_RISK_RATING_GRADES = ["AAA", "AA", "A", "BBB", "BB", "B"] as const;

export type SoukscoreRiskRating = (typeof SOUKSCORE_RISK_RATING_GRADES)[number];

export function isSoukscoreRiskRating(value: unknown): value is SoukscoreRiskRating {
  return typeof value === "string" && (SOUKSCORE_RISK_RATING_GRADES as readonly string[]).includes(value);
}
