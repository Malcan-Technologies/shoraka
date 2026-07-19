/**
 * SECTION: Build Page 2 SoukScore Risk Rating Scale view-model
 * WHY: AAA–B structural scale with optional selection; no invented labels/definitions
 */

import { isSoukscoreRiskRating } from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_SOUKSCORE_GRADE_ORDER,
  PROSPECTUS_SOUKSCORE_RATING_SCALE_AUDIT,
  PROSPECTUS_SOUKSCORE_RATING_SCALE_SECTION_HEADING,
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
    assessmentNote: PROSPECTUS_DATA_NOT_AVAILABLE,
    grades: PROSPECTUS_SOUKSCORE_GRADE_ORDER.map((grade) => ({
      grade,
      riskLabel: PROSPECTUS_DATA_NOT_AVAILABLE,
      definition: PROSPECTUS_DATA_NOT_AVAILABLE,
      isSelected: selected != null && grade === selected,
    })),
    audit: PROSPECTUS_SOUKSCORE_RATING_SCALE_AUDIT,
  };
}
