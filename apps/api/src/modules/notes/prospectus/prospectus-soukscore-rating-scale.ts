/**
 * SECTION: Build Page 2 Cashsouk Risk Rating Scale view-model
 * WHY: A–F catalogue from Grade and Pricing Matrix; colours from shared reference
 */

import {
  getReadableTextColor,
  isSoukscoreRiskRating,
  SOUKSCORE_RISK_RATING_CATALOGUE,
} from "@cashsouk/types";
import {
  PROSPECTUS_SOUKSCORE_GRADE_ORDER,
  PROSPECTUS_SOUKSCORE_RATING_NOT_AVAILABLE,
  PROSPECTUS_SOUKSCORE_RATING_SCALE_AUDIT,
  PROSPECTUS_SOUKSCORE_RATING_SCALE_SECTION_HEADING,
  PROSPECTUS_SOUKSCORE_SCALE_VERSION,
  type ProspectusSoukscoreRatingScale,
  type ProspectusSoukscoreRatingScaleInput,
} from "./prospectus-soukscore-rating-scale.types";

export function buildProspectusSoukscoreRatingScale(
  input: ProspectusSoukscoreRatingScaleInput = {}
): ProspectusSoukscoreRatingScale {
  const selected = isSoukscoreRiskRating(input.selectedRiskRating)
    ? input.selectedRiskRating
    : null;

  return {
    sectionHeading: PROSPECTUS_SOUKSCORE_RATING_SCALE_SECTION_HEADING,
    grades: PROSPECTUS_SOUKSCORE_GRADE_ORDER.map((grade) => {
      const entry = SOUKSCORE_RISK_RATING_CATALOGUE[grade];
      return {
        grade,
        label: entry.label,
        explanation: entry.explanation,
        color: entry.color,
        textColor: getReadableTextColor(entry.color),
        isSelected: selected != null && grade === selected,
      };
    }),
    selectedGrade: selected,
    missingRatingMessage:
      selected == null ? PROSPECTUS_SOUKSCORE_RATING_NOT_AVAILABLE : null,
    scaleVersion: PROSPECTUS_SOUKSCORE_SCALE_VERSION,
    audit: PROSPECTUS_SOUKSCORE_RATING_SCALE_AUDIT,
  };
}
