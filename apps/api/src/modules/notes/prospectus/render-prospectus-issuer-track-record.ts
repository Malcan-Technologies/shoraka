/**
 * SECTION: Issuer Track-Record Summary HTML orchestration
 * WHY: Stage 7 data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD } from "./prospectus-issuer-track-record.sample-data";
import { buildProspectusIssuerTrackRecordHtml } from "./prospectus-issuer-track-record.html";
import type { ProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record.types";

export function buildProspectusIssuerTrackRecordDocument(
  data: ProspectusIssuerTrackRecord = SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD
): string {
  return buildProspectusIssuerTrackRecordHtml(data);
}
