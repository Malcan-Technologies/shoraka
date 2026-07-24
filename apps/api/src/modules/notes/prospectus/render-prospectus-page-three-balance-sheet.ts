/**
 * SECTION: Page 3 Stage 3 balance sheet HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET } from "./prospectus-page-three-balance-sheet.sample-data";
import { buildProspectusPageThreeBalanceSheetHtml } from "./prospectus-page-three-balance-sheet.html";
import type { ProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet.types";

export function buildProspectusPageThreeBalanceSheetDocument(
  data: ProspectusPageThreeBalanceSheet = SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET
): string {
  return buildProspectusPageThreeBalanceSheetHtml(data);
}
