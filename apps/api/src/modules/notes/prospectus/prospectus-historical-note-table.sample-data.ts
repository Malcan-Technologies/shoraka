/**
 * SECTION: Sample Historical Note Table for Stage 8 preview
 * WHY: Raw rows prove formatting + current-Note exclusion; no DB eligibility filter
 */

import { buildProspectusHistoricalNoteTable } from "./prospectus-historical-note-table";
import type {
  ProspectusHistoricalNoteRowInput,
  ProspectusHistoricalNoteTableRow,
} from "./prospectus-historical-note-table.types";

export const SAMPLE_PROSPECTUS_CURRENT_NOTE_ID = "note-current-prospectus";
export const SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID = "org-issuer-sample-001";

/** Includes current Note + other-issuer row to prove filters. */
export const SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS: ProspectusHistoricalNoteRowInput[] = [
  {
    id: "note-hist-repaid-001",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20240110-AAAA1111",
    noteStatus: "REPAID",
    productName: "Accounts Receivable Financing-i",
    targetAmount: 300_000,
    fundedAmount: 300_000,
    profitRatePercent: 10,
    listingOpensAt: "2024-01-10T00:00:00.000Z",
    maturityDate: "2024-05-09T00:00:00.000Z",
    activatedAt: "2024-01-24T00:00:00.000Z",
    repaidAt: "2024-05-08T00:00:00.000Z",
  },
  {
    id: "note-hist-active-002",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20250301-BBBB2222",
    noteStatus: "ACTIVE",
    productName: "Accounts Receivable Financing-i",
    targetAmount: 450_000,
    fundedAmount: 400_000,
    profitRatePercent: 11,
    listingOpensAt: "2025-03-01T00:00:00.000Z",
    maturityDate: "2025-06-29T00:00:00.000Z",
    activatedAt: "2025-03-15T00:00:00.000Z",
    repaidAt: null,
  },
  {
    id: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20250515-0187ABCD",
    noteStatus: "PUBLISHED",
    productName: "Accounts Receivable Financing-i",
    targetAmount: 500_000,
    fundedAmount: 0,
    profitRatePercent: 12,
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
    activatedAt: null,
    repaidAt: null,
  },
  {
    id: "note-other-issuer",
    issuerOrganizationId: "org-other-issuer",
    noteReference: "NOTE-20240201-CCCC3333",
    noteStatus: "REPAID",
    productName: "Other Product",
    targetAmount: 100_000,
    fundedAmount: 100_000,
    profitRatePercent: 9,
    listingOpensAt: "2024-02-01T00:00:00.000Z",
    maturityDate: "2024-06-01T00:00:00.000Z",
    activatedAt: "2024-02-10T00:00:00.000Z",
    repaidAt: "2024-05-30T00:00:00.000Z",
  },
];

export const SAMPLE_PROSPECTUS_HISTORICAL_NOTE_TABLE: ProspectusHistoricalNoteTableRow[] =
  buildProspectusHistoricalNoteTable(SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS, {
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    currentNoteId: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
  });
