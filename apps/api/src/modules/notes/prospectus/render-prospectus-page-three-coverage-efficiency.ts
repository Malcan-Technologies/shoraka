/**
 * SECTION: Page 3 Stage 4 coverage/efficiency HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY } from "./prospectus-page-three-coverage-efficiency.sample-data";
import { buildProspectusPageThreeCoverageEfficiencyHtml } from "./prospectus-page-three-coverage-efficiency.html";
import type { ProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency.types";

export function buildProspectusPageThreeCoverageEfficiencyDocument(
  data: ProspectusPageThreeCoverageEfficiency = SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY
): string {
  return buildProspectusPageThreeCoverageEfficiencyHtml(data);
}
