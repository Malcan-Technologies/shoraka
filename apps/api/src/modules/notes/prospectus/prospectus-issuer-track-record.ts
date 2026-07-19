/**
 * SECTION: Build Issuer Track-Record Summary view-model
 * WHY: Static heading + four Canva metrics as DNA; no status filter, aggregate, or dashboard reuse
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_TRACK_RECORD_AUDIT,
  PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING,
  type ProspectusIssuerTrackRecord,
  type ProspectusIssuerTrackRecordInput,
} from "./prospectus-issuer-track-record.types";

export function buildProspectusIssuerTrackRecord(
  input: ProspectusIssuerTrackRecordInput = {}
): ProspectusIssuerTrackRecord {
  // Observational only — prove these never become Canva-facing aggregates.
  void input.currentNoteId;
  void input.issuerOrganizationId;
  void input.historicalNotes;
  void input.dashboardOnTimePercent;
  void input.dashboardActiveNotesCount;
  void input.dashboardCompletedNotesCount;
  void input.dashboardPastFinancingAmount;

  return {
    sectionHeading: PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING,
    totalNotesFunded: PROSPECTUS_DATA_NOT_AVAILABLE,
    totalAmountFunded: PROSPECTUS_DATA_NOT_AVAILABLE,
    successfulRepayment: PROSPECTUS_DATA_NOT_AVAILABLE,
    onTimePaymentRate: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_ISSUER_TRACK_RECORD_AUDIT,
  };
}
