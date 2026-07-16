/**
 * SECTION: Build Risk Assessment view-model from raw inputs
 * WHY: Pure Stage 3 preview — no Prisma, no invented grade→label mapping
 */

import { isSoukscoreRiskRating } from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_RATING_SCALE_REFERENCE,
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
    riskGrade: grade ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    riskLabel: PROSPECTUS_DATA_NOT_AVAILABLE,
    riskScore: PROSPECTUS_DATA_NOT_AVAILABLE,
    riskExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    ratingScaleReference: PROSPECTUS_RATING_SCALE_REFERENCE,
    riskAppliesTo: grade
      ? "invoice (frozen on note via invoice_snapshot.offer_details.risk_rating)"
      : PROSPECTUS_DATA_NOT_AVAILABLE,
    assessmentSource: grade
      ? "Admin SoukScore on invoice offer (offer_details.risk_rating)"
      : PROSPECTUS_DATA_NOT_AVAILABLE,
  };
}
