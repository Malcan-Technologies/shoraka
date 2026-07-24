/**
 * SECTION: Build Risk Assessment view-model
 * WHY: Canva shows SoukScore grade + catalogue label/explanation; no separate storage
 */

import { resolveSoukscoreRiskRatingPresentation } from "@cashsouk/types";
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
  const presentation = resolveSoukscoreRiskRatingPresentation(input.soukscoreRiskRating);

  return {
    canva: {
      riskGrade: presentation.grade,
      riskLabel: presentation.label,
      riskExplanation: presentation.description,
      riskGradeColor: presentation.color,
      riskGradeTextColor: presentation.textColor,
      ratingScaleReference: PROSPECTUS_RATING_SCALE_REFERENCE,
    },
    audit: {
      riskScore: PROSPECTUS_DATA_NOT_AVAILABLE,
      riskAppliesTo: presentation.isAvailable
        ? "Invoice offer, frozen on Note snapshot"
        : PROSPECTUS_DATA_NOT_AVAILABLE,
      assessmentSource: presentation.isAvailable
        ? "Admin Cashsouk Risk Rating on invoice offer"
        : PROSPECTUS_DATA_NOT_AVAILABLE,
      isFrozen: presentation.isAvailable,
      scaleStatus: PROSPECTUS_RATING_SCALE_STATUS,
    },
  };
}
