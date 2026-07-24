/**
 * SECTION: Page 2 Invoice & Paymaster Information HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_INVOICE_PAYMASTER } from "./prospectus-invoice-paymaster.sample-data";
import { buildProspectusInvoicePaymasterHtml } from "./prospectus-invoice-paymaster.html";
import type { ProspectusInvoicePaymaster } from "./prospectus-invoice-paymaster.types";

export function buildProspectusInvoicePaymasterDocument(
  data: ProspectusInvoicePaymaster = SAMPLE_PROSPECTUS_INVOICE_PAYMASTER
): string {
  return buildProspectusInvoicePaymasterHtml(data);
}
