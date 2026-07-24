/**
 * SECTION: Return Investor Highlight HTML orchestration
 * WHY: Stage 5C data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT } from "./prospectus-return-highlight.sample-data";
import { buildProspectusReturnHighlightHtml } from "./prospectus-return-highlight.html";
import type { ProspectusReturnHighlight } from "./prospectus-return-highlight.types";

export function buildProspectusReturnHighlightDocument(
  data: ProspectusReturnHighlight = SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT
): string {
  return buildProspectusReturnHighlightHtml(data);
}
