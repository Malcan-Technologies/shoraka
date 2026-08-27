/**
 * SECTION: Build Risk Assessment view-model
 * WHY: Frozen Invoice/Note MARC SME grade + official individual Risk Profile; no A–F fallback
 */

import { resolveMarcNoteRiskPresentation } from "@cashsouk/types";
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
  const presentation = resolveMarcNoteRiskPresentation(input.soukscoreRiskRating);

  return {
    canva: {
      riskGrade: presentation.grade,
      riskLabel: presentation.label,
      riskExplanation: presentation.riskProfile,
      riskGradeColor: presentation.color,
      riskGradeTextColor: presentation.textColor,
      ratingScaleReference: PROSPECTUS_RATING_SCALE_REFERENCE,
      marcCreditScoreDisplay: null,
      marcProbabilityOfDefaultDisplay: null,
    },
    audit: {
      riskScore: PROSPECTUS_DATA_NOT_AVAILABLE,
      riskAppliesTo: presentation.isAvailable
        ? "Invoice offer, frozen on Note snapshot"
        : PROSPECTUS_DATA_NOT_AVAILABLE,
      isFrozen: presentation.isAvailable,
      assessmentSource: presentation.isAvailable
        ? "Admin MARC SME risk rating on invoice offer"
        : PROSPECTUS_DATA_NOT_AVAILABLE,
      scaleStatus: PROSPECTUS_RATING_SCALE_STATUS,
    },
  };
}
