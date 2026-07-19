/**
 * SECTION: Sample Issuer Track-Record Summary for Stage 7 preview
 * WHY: Include historical/dashboard observations; Canva-facing metrics stay DNA
 */

import { buildProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record";
import type {
  ProspectusIssuerTrackRecord,
  ProspectusIssuerTrackRecordInput,
} from "./prospectus-issuer-track-record.types";

/**
 * Sample history + dashboard values prove Stage 7 does not invent prospectus aggregates.
 * None of these become Canva-facing metrics.
 */
export const SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD_INPUT: ProspectusIssuerTrackRecordInput = {
  currentNoteId: "note-current-001",
  issuerOrganizationId: "org-issuer-001",
  historicalNotes: [
    {
      id: "note-hist-001",
      status: "REPAID",
      fundedAmount: 500_000,
      targetAmount: 500_000,
      fundingStatus: "FUNDED",
      activatedAt: "2024-01-15T00:00:00.000Z",
    },
    {
      id: "note-hist-002",
      status: "REPAID",
      fundedAmount: 750_000,
      targetAmount: 800_000,
      fundingStatus: "FUNDED",
      activatedAt: "2024-06-01T00:00:00.000Z",
    },
    {
      id: "note-hist-003",
      status: "ACTIVE",
      fundedAmount: 1_200_000,
      targetAmount: 1_200_000,
      fundingStatus: "FUNDED",
      activatedAt: "2025-02-01T00:00:00.000Z",
    },
  ],
  dashboardOnTimePercent: 100,
  dashboardActiveNotesCount: 1,
  dashboardCompletedNotesCount: 2,
  dashboardPastFinancingAmount: 1_250_000,
};

export const SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD: ProspectusIssuerTrackRecord =
  buildProspectusIssuerTrackRecord(SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD_INPUT);
