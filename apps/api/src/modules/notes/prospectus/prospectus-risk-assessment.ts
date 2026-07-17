/**
 * SECTION: Build Risk Assessment view-model
 * WHY: Canva shows SoukScore grade only; label/explanation DNA; audit kept separate
 */

import { isSoukscoreRiskRating } from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_RATING_SCALE_REFERENCE,
  PROSPECTUS_RATING_SCALE_STATUS,
  type ProspectusRiskAssessment,
  type ProspectusRiskAssessmentInput,
} from "./prospectus-risk-assessment.types";

export function buildProspectusRiskAssessment(
  input: ProspectusRiskAssessmentInput
): ProspectusRiskAssessment {
  const grade = isSoukscoreRiskRating(input.soukscoreRiskRating)
    ? input.soukscoreRiskRating
    : null;

  return {
    canva: {
      riskGrade: grade ?? PROSPECTUS_DATA_NOT_AVAILABLE,
      riskLabel: PROSPECTUS_DATA_NOT_AVAILABLE,
      riskExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
      ratingScaleReference: PROSPECTUS_RATING_SCALE_REFERENCE,
    },
    audit: {
      riskScore: PROSPECTUS_DATA_NOT_AVAILABLE,
      riskAppliesTo: grade
        ? "Invoice offer, frozen on Note snapshot"
        : PROSPECTUS_DATA_NOT_AVAILABLE,
      assessmentSource: grade
        ? "Admin SoukScore on invoice offer"
        : PROSPECTUS_DATA_NOT_AVAILABLE,
      isFrozen: grade != null,
      scaleStatus: PROSPECTUS_RATING_SCALE_STATUS,
    },
  };
}
