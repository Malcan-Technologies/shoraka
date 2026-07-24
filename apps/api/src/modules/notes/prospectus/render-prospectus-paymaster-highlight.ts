/**
 * SECTION: Paymaster Investor Highlight HTML orchestration
 * WHY: Stage 5A data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT } from "./prospectus-paymaster-highlight.sample-data";
import { buildProspectusPaymasterHighlightHtml } from "./prospectus-paymaster-highlight.html";
import type { ProspectusPaymasterHighlight } from "./prospectus-paymaster-highlight.types";

export function buildProspectusPaymasterHighlightDocument(
  data: ProspectusPaymasterHighlight = SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT
): string {
  return buildProspectusPaymasterHighlightHtml(data);
}
