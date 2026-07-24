/**
 * SECTION: Page 2 Paymaster Track Record HTML orchestration
 * WHY: Stage preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_PAYMASTER_TRACK_RECORD } from "./prospectus-paymaster-track-record.sample-data";
import { buildProspectusPaymasterTrackRecordHtml } from "./prospectus-paymaster-track-record.html";
import type { ProspectusPaymasterTrackRecord } from "./prospectus-paymaster-track-record.types";

export function buildProspectusPaymasterTrackRecordDocument(
  data: ProspectusPaymasterTrackRecord = SAMPLE_PROSPECTUS_PAYMASTER_TRACK_RECORD
): string {
  return buildProspectusPaymasterTrackRecordHtml(data);
}
