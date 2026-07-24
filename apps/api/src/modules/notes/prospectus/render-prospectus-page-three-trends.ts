/**
 * SECTION: Page 3 Stage 5 trends HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS } from "./prospectus-page-three-trends.sample-data";
import { buildProspectusPageThreeTrendsHtml } from "./prospectus-page-three-trends.html";
import type { ProspectusPageThreeTrends } from "./prospectus-page-three-trends.types";

export function buildProspectusPageThreeTrendsDocument(
  data: ProspectusPageThreeTrends = SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS
): string {
  return buildProspectusPageThreeTrendsHtml(data);
}
