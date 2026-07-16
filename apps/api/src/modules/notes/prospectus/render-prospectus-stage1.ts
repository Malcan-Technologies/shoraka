/**
 * SECTION: Stage 1 prospectus HTML orchestration
 * WHY: Data preview only — no Prisma, S3, routes, or design
 */

import { SAMPLE_PROSPECTUS_STAGE1_TERMS } from "./prospectus.sample-data";
import { buildProspectusStage1Html } from "./prospectus-stage1.html";
import type { ProspectusStage1Terms } from "./prospectus.types";

export function buildProspectusStage1Document(
  terms: ProspectusStage1Terms = SAMPLE_PROSPECTUS_STAGE1_TERMS
): string {
  return buildProspectusStage1Html(terms);
}
