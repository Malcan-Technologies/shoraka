/**
 * SECTION: Sample Historical Note Table for Stage 8 preview
 * WHY: Caller-supplied rows only; Amount DNA; raw status; no ARF / Fully Repaid invention
 */

import { buildProspectusHistoricalNoteTable } from "./prospectus-historical-note-table";
import type {
  ProspectusHistoricalNoteRowInput,
  ProspectusHistoricalNoteTable,
} from "./prospectus-historical-note-table.types";

export const SAMPLE_PROSPECTUS_CURRENT_NOTE_ID = "note-current-prospectus";
export const SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID = "org-issuer-sample-001";

/**
 * Preview rows already exclude the current Note (future query responsibility).
 * Includes REPAID + ACTIVE + extra statuses to prove no eligibility filter / row limit.
 */
export const SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS: ProspectusHistoricalNoteRowInput[] = [
  {
    id: "note-hist-repaid-001",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20240110-AAAA1111",
    noteStatus: "REPAID",
    productName: "Accounts Receivable Financing-i",
    targetAmount: 500_000,
    fundedAmount: 500_000,
    profitRatePercent: 12,
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
    activatedAt: "2025-05-20T00:00:00.000Z",
    repaidAt: "2025-02-12T00:00:00.000Z",
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
    id: "note-hist-arrears-003",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20240201-CCCC3333",
    noteStatus: "ARREARS",
    productName: "Accounts Receivable Financing-i",
    targetAmount: 200_000,
    fundedAmount: 200_000,
    profitRatePercent: 10,
    listingOpensAt: "2024-02-01T00:00:00.000Z",
    maturityDate: "2024-05-31T00:00:00.000Z",
    activatedAt: "2024-02-10T00:00:00.000Z",
    repaidAt: null,
  },
  {
    id: "note-hist-defaulted-004",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20231101-DDDD4444",
    noteStatus: "DEFAULTED",
    productName: "Accounts Receivable Financing-i",
    targetAmount: 150_000,
    fundedAmount: 150_000,
    profitRatePercent: 9,
    listingOpensAt: "2023-11-01T00:00:00.000Z",
    maturityDate: "2024-02-29T00:00:00.000Z",
    activatedAt: "2023-11-15T00:00:00.000Z",
    repaidAt: null,
  },
];

export const SAMPLE_PROSPECTUS_HISTORICAL_NOTE_TABLE: ProspectusHistoricalNoteTable =
  buildProspectusHistoricalNoteTable(SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS, {
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    currentNoteId: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
  });
