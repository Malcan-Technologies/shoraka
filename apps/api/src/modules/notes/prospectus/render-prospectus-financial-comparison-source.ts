/**
 * SECTION: Page 2 Stage 4A financial comparison source HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE } from "./prospectus-financial-comparison-source.sample-data";
import { buildProspectusFinancialComparisonSourceHtml } from "./prospectus-financial-comparison-source.html";
import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";

export function buildProspectusFinancialComparisonSourceDocument(
  data: ProspectusFinancialComparisonSource = SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE
): string {
  return buildProspectusFinancialComparisonSourceHtml(data);
}
