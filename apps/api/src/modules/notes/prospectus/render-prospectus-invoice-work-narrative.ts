/**
 * SECTION: Page 2 About the Invoice / Work Performed HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE } from "./prospectus-invoice-work-narrative.sample-data";
import { buildProspectusInvoiceWorkNarrativeHtml } from "./prospectus-invoice-work-narrative.html";
import type { ProspectusInvoiceWorkNarrative } from "./prospectus-invoice-work-narrative.types";

export function buildProspectusInvoiceWorkNarrativeDocument(
  data: ProspectusInvoiceWorkNarrative = SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE
): string {
  return buildProspectusInvoiceWorkNarrativeHtml(data);
}
