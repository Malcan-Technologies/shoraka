/**
 * SECTION: Timing & Purpose HTML orchestration
 * WHY: Stage 4B data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_TIMING_PURPOSE } from "./prospectus-timing-purpose.sample-data";
import { buildProspectusTimingPurposeHtml } from "./prospectus-timing-purpose.html";
import type { ProspectusTimingPurpose } from "./prospectus-timing-purpose.types";

export function buildProspectusTimingPurposeDocument(
  data: ProspectusTimingPurpose = SAMPLE_PROSPECTUS_TIMING_PURPOSE
): string {
  return buildProspectusTimingPurposeHtml(data);
}
