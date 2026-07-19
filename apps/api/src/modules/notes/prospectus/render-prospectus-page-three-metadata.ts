/**
 * SECTION: Page 3 Stage 1 metadata HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAGE_THREE_METADATA } from "./prospectus-page-three-metadata.sample-data";
import { buildProspectusPageThreeMetadataHtml } from "./prospectus-page-three-metadata.html";
import type { ProspectusPageThreeMetadata } from "./prospectus-page-three-metadata.types";

export function buildProspectusPageThreeMetadataDocument(
  data: ProspectusPageThreeMetadata = SAMPLE_PROSPECTUS_PAGE_THREE_METADATA
): string {
  return buildProspectusPageThreeMetadataHtml(data);
}
