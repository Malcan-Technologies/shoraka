/**
 * SECTION: Payment Basis & Shariah HTML orchestration
 * WHY: Stage 4C data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH } from "./prospectus-payment-basis-shariah.sample-data";
import { buildProspectusPaymentBasisShariahHtml } from "./prospectus-payment-basis-shariah.html";
import type { ProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah.types";

export function buildProspectusPaymentBasisShariahDocument(
  data: ProspectusPaymentBasisShariah = SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH
): string {
  return buildProspectusPaymentBasisShariahHtml(data);
}
