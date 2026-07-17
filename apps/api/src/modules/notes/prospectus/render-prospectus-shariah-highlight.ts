/**
 * SECTION: Shariah Investor Highlight HTML orchestration
 * WHY: Stage 5D data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT } from "./prospectus-shariah-highlight.sample-data";
import { buildProspectusShariahHighlightHtml } from "./prospectus-shariah-highlight.html";
import type { ProspectusShariahHighlight } from "./prospectus-shariah-highlight.types";

export function buildProspectusShariahHighlightDocument(
  data: ProspectusShariahHighlight = SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT
): string {
  return buildProspectusShariahHighlightHtml(data);
}
