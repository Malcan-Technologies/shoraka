/**
 * SECTION: Build Issuer Track-Record Summary view-model
 * WHY: Document identity key; do not invent prospectus status filters or aggregates
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE,
  type ProspectusIssuerTrackRecord,
  type ProspectusIssuerTrackRecordInput,
} from "./prospectus-issuer-track-record.types";

export function buildProspectusIssuerTrackRecord(
  _input: ProspectusIssuerTrackRecordInput = {}
): ProspectusIssuerTrackRecord {
  return {
    issuerIdentitySource: PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE,
    previousIssuedNotes: PROSPECTUS_DATA_NOT_AVAILABLE,
    successfullyFundedNotes: PROSPECTUS_DATA_NOT_AVAILABLE,
    activeNotes: PROSPECTUS_DATA_NOT_AVAILABLE,
    fullyRepaidNotes: PROSPECTUS_DATA_NOT_AVAILABLE,
    totalHistoricalAmountRaised: PROSPECTUS_DATA_NOT_AVAILABLE,
    onTimeRepaymentRate: PROSPECTUS_DATA_NOT_AVAILABLE,
    defaultCount: PROSPECTUS_DATA_NOT_AVAILABLE,
    averageInvestorReturn: PROSPECTUS_DATA_NOT_AVAILABLE,
    trackRecordSummaryTitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    trackRecordSummaryExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    dataFrozenOnCurrentNote: "No",
  };
}
