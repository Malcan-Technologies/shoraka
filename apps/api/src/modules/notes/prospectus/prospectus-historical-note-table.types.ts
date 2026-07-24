/**
 * SECTION: Prospectus Page 1 — Historical Note Table (DATA STAGE 8)
 * WHY: Exact Canva columns; funded_amount; confirmed status labels; freeze at publish
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export const PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS = [
  "Note ID",
  "Financing Type",
  "Amount (RM)",
  "Tenure",
  "Profit Rate (p.a.)",
  "Status",
  "Repayment Date",
] as const;

export const PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE = "No notes are available yet.";

export const PROSPECTUS_HISTORICAL_NOTE_ROW_LIMIT = 4;

export interface ProspectusHistoricalNoteTableRow {
  noteId: string;
  financingType: string;
  amountRm: string;
  tenure: string;
  profitRate: string;
  status: string;
  repaymentDate: string;
}

export interface ProspectusHistoricalNoteTableAudit {
  identity: {
    issuerGroupingKey: "notes.issuer_organization_id";
    currentNoteExclusionKey: "notes.id";
    currentNoteExclusionRequired: true;
  };
  eligibility: {
    statuses: readonly ["ACTIVE", "REPAID", "ARREARS", "DEFAULTED"];
    sort: "updated_at DESC";
    rowLimit: 4;
  };
  snapshot: {
    isFrozen: boolean;
    snapshotDecision: "frozen_at_publish" | "live_preview" | "caller_supplied";
  };
}

export interface ProspectusHistoricalNoteTable {
  rows: ProspectusHistoricalNoteTableRow[];
  emptyStateMessage: string | null;
  audit: ProspectusHistoricalNoteTableAudit;
}

/** Caller-supplied row for unit tests / previews (not Prisma). */
export interface ProspectusHistoricalNoteRowInput {
  id: string;
  issuerOrganizationId: string;
  noteReference: string | null | undefined;
  noteStatus: string | null | undefined;
  productName: string | null | undefined;
  fundedAmount: number | null | undefined;
  /** Observational — must not become Amount (RM). */
  targetAmount?: number | null;
  profitRatePercent: number | null | undefined;
  listingOpensAt: Date | string | null | undefined;
  maturityDate: Date | string | null | undefined;
  repaidAt: Date | string | null | undefined;
  updatedAt: Date | string;
}
