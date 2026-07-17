/**
 * SECTION: At a Glance HTML orchestration
 * WHY: Stage 6 data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_AT_A_GLANCE } from "./prospectus-at-a-glance.sample-data";
import { buildProspectusAtAGlanceHtml } from "./prospectus-at-a-glance.html";
import type { ProspectusAtAGlance } from "./prospectus-at-a-glance.types";

export function buildProspectusAtAGlanceDocument(
  data: ProspectusAtAGlance = SAMPLE_PROSPECTUS_AT_A_GLANCE
): string {
  return buildProspectusAtAGlanceHtml(data);
}
