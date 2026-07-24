/**
 * SECTION: Page 3 Stage 2 income statement HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT } from "./prospectus-page-three-income-statement.sample-data";
import { buildProspectusPageThreeIncomeStatementHtml } from "./prospectus-page-three-income-statement.html";
import type { ProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement.types";

export function buildProspectusPageThreeIncomeStatementDocument(
  data: ProspectusPageThreeIncomeStatement = SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT
): string {
  return buildProspectusPageThreeIncomeStatementHtml(data);
}
