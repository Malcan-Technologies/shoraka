/**
 * SECTION: Page 3 HTML orchestration
 * WHY: Thin render entry for preview scripts
 */

import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "./prospectus-page-three.sample-data";
import type { ProspectusPageThree } from "./prospectus-page-three.types";

export function renderProspectusPageThreeHtml(
  page: ProspectusPageThree = SAMPLE_PROSPECTUS_PAGE_THREE
): string {
  return buildProspectusPageThreeHtml(page);
}
