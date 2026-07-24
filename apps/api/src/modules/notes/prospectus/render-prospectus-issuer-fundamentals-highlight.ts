/**
 * SECTION: Issuer Financial-Strength Highlight HTML orchestration
 * WHY: Stage 5B data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT } from "./prospectus-issuer-fundamentals-highlight.sample-data";
import { buildProspectusIssuerFundamentalsHighlightHtml } from "./prospectus-issuer-fundamentals-highlight.html";
import type { ProspectusIssuerFundamentalsHighlight } from "./prospectus-issuer-fundamentals-highlight.types";

export function buildProspectusIssuerFundamentalsHighlightDocument(
  data: ProspectusIssuerFundamentalsHighlight = SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT
): string {
  return buildProspectusIssuerFundamentalsHighlightHtml(data);
}
