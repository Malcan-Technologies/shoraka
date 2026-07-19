/**
 * SECTION: Sample Issuer Track-Record for Stage 7 preview
 * WHY: Illustrative computed metrics; proves formatting without inventing Canva 8 / 100% claims as production rules
 */

import { buildProspectusIssuerTrackRecordFromMetrics } from "./prospectus-issuer-track-record";
import type { ProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record.types";

export const SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD: ProspectusIssuerTrackRecord =
  buildProspectusIssuerTrackRecordFromMetrics({
    totalNotesFunded: 3,
    totalAmountFunded: 1_150_000,
    successfulRepaymentPercent: 50,
    onTimePaymentRateSixMonthsPercent: 100,
    isFrozen: false,
  });
