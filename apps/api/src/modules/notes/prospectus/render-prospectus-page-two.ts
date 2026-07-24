/**
 * SECTION: Prospectus Page 2 HTML render entry
 * WHY: Thin wrapper for preview scripts and callers
 */

import { buildProspectusPageTwoHtml } from "./prospectus-page-two.html";
import type { ProspectusPageTwo } from "./prospectus-page-two.types";

export function renderProspectusPageTwoHtml(page: ProspectusPageTwo): string {
  return buildProspectusPageTwoHtml(page);
}
