/**
 * SECTION: Main Financial Terms HTML orchestration
 * WHY: Stage 4A data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS } from "./prospectus-main-financial-terms.sample-data";
import { buildProspectusMainFinancialTermsHtml } from "./prospectus-main-financial-terms.html";
import type { ProspectusMainFinancialTerms } from "./prospectus-main-financial-terms.types";

export function buildProspectusMainFinancialTermsDocument(
  data: ProspectusMainFinancialTerms = SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS
): string {
  return buildProspectusMainFinancialTermsHtml(data);
}
