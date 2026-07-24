/**
 * SECTION: Prospectus Page 1 — Issuer Track-Record Summary (DATA STAGE 7)
 * WHY: Funded-history aggregates + 6-month on-time; frozen at publish
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export const PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING =
  "ISSUER'S TRACK RECORD ON CASH SOUK";

export const PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE =
  "notes.issuer_organization_id";

export const PROSPECTUS_ISSUER_TRACK_RECORD_CURRENT_NOTE_EXCLUSION_KEY = "notes.id";

/** All-time funded-history metrics (eligible notes; current note excluded). */
export const PROSPECTUS_TOTAL_NOTES_FUNDED_LABEL = "Total Notes Funded — All Time";
export const PROSPECTUS_TOTAL_AMOUNT_FUNDED_LABEL = "Total Amount Funded — All Time";
export const PROSPECTUS_SUCCESSFUL_REPAYMENT_LABEL = "Successful Repayment — All Time";

/** Schedule-level on-time rate for the last 6 months only. */
export const PROSPECTUS_ON_TIME_PAYMENT_RATE_LABEL =
  "On-time Payment Rate — Last 6 Months";

export interface ProspectusIssuerTrackRecordAudit {
  issuer: {
    groupingKey: typeof PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE;
    currentNoteExclusionKey: typeof PROSPECTUS_ISSUER_TRACK_RECORD_CURRENT_NOTE_EXCLUSION_KEY;
    currentNoteExcluded: true;
  };
  eligibility: {
    statuses: readonly ["ACTIVE", "REPAID", "ARREARS", "DEFAULTED"];
  };
  snapshot: {
    isFrozen: boolean;
    snapshotDecision: "frozen_at_publish" | "live_preview";
  };
}

export interface ProspectusIssuerTrackRecord {
  sectionHeading: string;
  totalNotesFunded: string;
  totalAmountFunded: string;
  successfulRepayment: string;
  onTimePaymentRate: string;
  onTimePaymentRateLabel: string;
  audit: ProspectusIssuerTrackRecordAudit;
}

export interface ProspectusIssuerTrackRecordMetricsInput {
  totalNotesFunded: number | null | undefined;
  totalAmountFunded: number | string | null | undefined;
  successfulRepaymentPercent: number | null | undefined;
  onTimePaymentRateSixMonthsPercent: number | null | undefined;
  isFrozen?: boolean;
}
