/**
 * SECTION: Page 2 Stage 4B financial comparison metrics HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS } from "./prospectus-financial-comparison-metrics.sample-data";
import { buildProspectusFinancialComparisonMetricsHtml } from "./prospectus-financial-comparison-metrics.html";
import type { ProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics.types";

export function buildProspectusFinancialComparisonMetricsDocument(
  data: ProspectusFinancialComparisonMetrics = SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS
): string {
  return buildProspectusFinancialComparisonMetricsHtml(data);
}
