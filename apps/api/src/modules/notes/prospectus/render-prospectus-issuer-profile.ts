/**
 * SECTION: Page 2 About the Issuer HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_ISSUER_PROFILE } from "./prospectus-issuer-profile.sample-data";
import { buildProspectusIssuerProfileHtml } from "./prospectus-issuer-profile.html";
import type { ProspectusIssuerProfile } from "./prospectus-issuer-profile.types";

export function buildProspectusIssuerProfileDocument(
  data: ProspectusIssuerProfile = SAMPLE_PROSPECTUS_ISSUER_PROFILE
): string {
  return buildProspectusIssuerProfileHtml(data);
}
