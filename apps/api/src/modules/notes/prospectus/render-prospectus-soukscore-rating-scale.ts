/**
 * SECTION: Page 2 SoukScore Risk Rating Scale HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE } from "./prospectus-soukscore-rating-scale.sample-data";
import { buildProspectusSoukscoreRatingScaleHtml } from "./prospectus-soukscore-rating-scale.html";
import type { ProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale.types";

export function buildProspectusSoukscoreRatingScaleDocument(
  data: ProspectusSoukscoreRatingScale = SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE
): string {
  return buildProspectusSoukscoreRatingScaleHtml(data);
}
