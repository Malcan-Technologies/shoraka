/**
 * SECTION: Page 2 Credit Insights HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_CREDIT_INSIGHTS } from "./prospectus-credit-insights.sample-data";
import { buildProspectusCreditInsightsHtml } from "./prospectus-credit-insights.html";
import type { ProspectusCreditInsights } from "./prospectus-credit-insights.types";

export function buildProspectusCreditInsightsDocument(
  data: ProspectusCreditInsights = SAMPLE_PROSPECTUS_CREDIT_INSIGHTS
): string {
  return buildProspectusCreditInsightsHtml(data);
}
