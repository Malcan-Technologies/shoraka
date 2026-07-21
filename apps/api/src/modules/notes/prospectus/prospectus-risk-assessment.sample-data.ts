/**
 * SECTION: Sample Risk Assessment for Stage 3 preview
 * WHY: Valid SoukScore AA with shared catalogue label/explanation
 */

import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import type {
  ProspectusRiskAssessment,
  ProspectusRiskAssessmentInput,
} from "./prospectus-risk-assessment.types";

/** Valid platform grade (AAA–B). Canva “A-” is rejected by isSoukscoreRiskRating. */
export const SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT: ProspectusRiskAssessmentInput = {
  soukscoreRiskRating: "AA",
};

export const SAMPLE_PROSPECTUS_RISK_ASSESSMENT: ProspectusRiskAssessment =
  buildProspectusRiskAssessment(SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT);
