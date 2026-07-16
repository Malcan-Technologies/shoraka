/**
 * SECTION: Sample Risk Assessment for Stage 3 preview
 * WHY: Use a valid SoukScore grade only; never Canva A- / Low Risk / explanation copy
 */

import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import type {
  ProspectusRiskAssessment,
  ProspectusRiskAssessmentInput,
} from "./prospectus-risk-assessment.types";

/** Valid platform grade (AAA–B). Canva “A-” is not a stored value. */
export const SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT: ProspectusRiskAssessmentInput = {
  soukscoreRiskRating: "A",
};

export const SAMPLE_PROSPECTUS_RISK_ASSESSMENT: ProspectusRiskAssessment =
  buildProspectusRiskAssessment(SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT);
