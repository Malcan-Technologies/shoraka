/**
 * SECTION: Sample Risk Assessment for Stage 3 preview
 * WHY: Valid MARC SME-3 grade with official grouping label and Risk Profile
 */

import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import type {
  ProspectusRiskAssessment,
  ProspectusRiskAssessmentInput,
} from "./prospectus-risk-assessment.types";

export const SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT: ProspectusRiskAssessmentInput = {
  soukscoreRiskRating: "SME-3",
};

export const SAMPLE_PROSPECTUS_RISK_ASSESSMENT: ProspectusRiskAssessment =
  buildProspectusRiskAssessment(SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT);
