/**
 * SECTION: Page 3 Stage 6 investor takeaways HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS } from "./prospectus-page-three-investor-takeaways.sample-data";
import { buildProspectusPageThreeInvestorTakeawaysHtml } from "./prospectus-page-three-investor-takeaways.html";
import type { ProspectusPageThreeInvestorTakeaways } from "./prospectus-page-three-investor-takeaways.types";

export function buildProspectusPageThreeInvestorTakeawaysDocument(
  data: ProspectusPageThreeInvestorTakeaways = SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS
): string {
  return buildProspectusPageThreeInvestorTakeawaysHtml(data);
}
