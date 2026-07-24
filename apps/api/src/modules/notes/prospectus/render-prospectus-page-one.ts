/**
 * SECTION: Page 1 HTML orchestration
 * WHY: Preview/tests call this without embedding Prisma in the HTML module
 */

import { buildProspectusPageOneHtml } from "./prospectus-page-one.html";
import type { ProspectusPageOne } from "./prospectus-page-one.types";

export function renderProspectusPageOneHtml(page: ProspectusPageOne): string {
  return buildProspectusPageOneHtml(page);
}
