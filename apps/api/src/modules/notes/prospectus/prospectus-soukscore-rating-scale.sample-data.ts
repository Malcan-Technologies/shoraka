/**
 * SECTION: Sample Page 2 SoukScore scale inputs for Stage 7 preview
 * WHY: Prove valid selection and DNA labels; no invented risk wording
 */

import { buildProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale";
import type {
  ProspectusSoukscoreRatingScale,
  ProspectusSoukscoreRatingScaleInput,
} from "./prospectus-soukscore-rating-scale.types";

/** Valid Note grade for preview highlight (structural only). */
export const SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT: ProspectusSoukscoreRatingScaleInput =
  {
    selectedRiskRating: "AA",
  };

export const SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INVALID_INPUT: ProspectusSoukscoreRatingScaleInput =
  {
    selectedRiskRating: "A-",
  };

export const SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_CANVA_INPUT: ProspectusSoukscoreRatingScaleInput =
  {
    selectedRiskRating: "C",
  };

export const SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_MISSING_INPUT: ProspectusSoukscoreRatingScaleInput =
  {};

export const SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE: ProspectusSoukscoreRatingScale =
  buildProspectusSoukscoreRatingScale(SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT);
