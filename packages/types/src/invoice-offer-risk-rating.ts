/**
 * SECTION: SoukScore manual risk grade on invoice offers
 * WHY: Placeholder until automated scoring; stored on invoices.offer_details
 * INPUT: API body or JSON risk_rating string
 * OUTPUT: Typed grade or type guard false
 * WHERE USED: Admin send-invoice-offer API, admin invoice review UI
 */

export const SOUKSCORE_RISK_RATING_GRADES = ["A", "B", "C"] as const;

export type SoukscoreRiskRating = (typeof SOUKSCORE_RISK_RATING_GRADES)[number];

export function isSoukscoreRiskRating(value: unknown): value is SoukscoreRiskRating {
  return value === "A" || value === "B" || value === "C";
}
