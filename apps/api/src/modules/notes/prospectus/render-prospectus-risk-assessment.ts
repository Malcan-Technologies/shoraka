/**
 * SECTION: Risk Assessment HTML orchestration
 * WHY: Stage 3 data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_RISK_ASSESSMENT } from "./prospectus-risk-assessment.sample-data";
import { buildProspectusRiskAssessmentHtml } from "./prospectus-risk-assessment.html";
import type { ProspectusRiskAssessment } from "./prospectus-risk-assessment.types";

export function buildProspectusRiskAssessmentDocument(
  data: ProspectusRiskAssessment = SAMPLE_PROSPECTUS_RISK_ASSESSMENT
): string {
  return buildProspectusRiskAssessmentHtml(data);
}
