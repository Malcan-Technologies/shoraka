/**
 * SECTION: Sample Risk Assessment for Stage 3 preview
 * WHY: Valid Cashsouk B grade with shared catalogue label/description/colour
 */

import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import type {
  ProspectusRiskAssessment,
  ProspectusRiskAssessmentInput,
} from "./prospectus-risk-assessment.types";

/** Valid platform grade (A–F). Legacy AAA/AA are rejected by isCashsoukRiskGrade. */
export const SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT: ProspectusRiskAssessmentInput = {
  soukscoreRiskRating: "B",
};

export const SAMPLE_PROSPECTUS_RISK_ASSESSMENT: ProspectusRiskAssessment =
  buildProspectusRiskAssessment(SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT);
