/**
 * SECTION: Dates & Paymaster HTML orchestration
 * WHY: Stage 2 data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_DATES_PAYMASTER } from "./prospectus-dates-paymaster.sample-data";
import { buildProspectusDatesPaymasterHtml } from "./prospectus-dates-paymaster.html";
import type { ProspectusDatesPaymaster } from "./prospectus-dates-paymaster.types";

export function buildProspectusDatesPaymasterDocument(
  data: ProspectusDatesPaymaster = SAMPLE_PROSPECTUS_DATES_PAYMASTER
): string {
  return buildProspectusDatesPaymasterHtml(data);
}
