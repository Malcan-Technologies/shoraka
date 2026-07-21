/**
 * SECTION: SoukScore manual risk grade on invoice offers
 * WHY: Admin financial review invoice offers; stored on invoices.offer_details
 * INPUT: API body or JSON risk_rating string
 * OUTPUT: Typed grade or type guard false
 * WHERE USED: Admin send-invoice-offer API, admin invoice review UI,
 *             Prospectus Page 1 risk card (label/explanation from catalogue)
 */

export const SOUKSCORE_RISK_RATING_GRADES = ["AAA", "AA", "A", "BBB", "BB", "B"] as const;

export type SoukscoreRiskRating = (typeof SOUKSCORE_RISK_RATING_GRADES)[number];

export function isSoukscoreRiskRating(value: unknown): value is SoukscoreRiskRating {
  return typeof value === "string" && (SOUKSCORE_RISK_RATING_GRADES as readonly string[]).includes(value);
}

/** Shared unavailable copy when grade is missing or invalid (Prospectus + Admin). */
export const SOUKSCORE_RISK_RATING_UNAVAILABLE = "Risk rating not available";

export type SoukscoreRiskRatingCatalogueEntry = {
  grade: SoukscoreRiskRating;
  label: string;
  explanation: string;
};

/**
 * Hard-coded SoukScore grade → label + explanation.
 * Single source for Admin, Page 1 HTML, and freeze-time resolution.
 * Do not duplicate this wording elsewhere.
 */
export const SOUKSCORE_RISK_RATING_CATALOGUE: Record<
  SoukscoreRiskRating,
  SoukscoreRiskRatingCatalogueEntry
> = {
  AAA: {
    grade: "AAA",
    label: "Very Low Risk",
    explanation:
      "The issuer demonstrates excellent financial strength and a very strong capacity to meet its financial obligations.",
  },
  AA: {
    grade: "AA",
    label: "Low Risk",
    explanation:
      "The issuer demonstrates strong financial strength and a strong capacity to meet its financial obligations.",
  },
  A: {
    grade: "A",
    label: "Moderately Low Risk",
    explanation:
      "The issuer demonstrates good financial strength and an adequate capacity to meet its financial obligations.",
  },
  BBB: {
    grade: "BBB",
    label: "Moderate Risk",
    explanation:
      "The issuer demonstrates adequate financial strength but may be more sensitive to adverse business or economic conditions.",
  },
  BB: {
    grade: "BB",
    label: "Elevated Risk",
    explanation:
      "The issuer shows some financial vulnerability and may face difficulty meeting its obligations under adverse conditions.",
  },
  B: {
    grade: "B",
    label: "High Risk",
    explanation:
      "The issuer shows significant financial vulnerability and a higher likelihood of repayment difficulty under adverse conditions.",
  },
};

export type SoukscoreRiskRatingPresentation = {
  grade: string;
  label: string;
  explanation: string;
  isAvailable: boolean;
};

/** Resolve display grade/label/explanation from offer risk_rating. No separate storage. */
export function resolveSoukscoreRiskRatingPresentation(
  value: unknown
): SoukscoreRiskRatingPresentation {
  if (!isSoukscoreRiskRating(value)) {
    return {
      grade: SOUKSCORE_RISK_RATING_UNAVAILABLE,
      label: SOUKSCORE_RISK_RATING_UNAVAILABLE,
      explanation: SOUKSCORE_RISK_RATING_UNAVAILABLE,
      isAvailable: false,
    };
  }
  const entry = SOUKSCORE_RISK_RATING_CATALOGUE[value];
  return {
    grade: entry.grade,
    label: entry.label,
    explanation: entry.explanation,
    isAvailable: true,
  };
}
