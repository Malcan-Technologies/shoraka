/**
 * SECTION: Sample Historical Note Table for Stage 8 preview
 * WHY: Eligible statuses, funded amounts, status labels; current Note excluded by builder
 */

import { buildProspectusHistoricalNoteTable } from "./prospectus-historical-note-table";
import type {
  ProspectusHistoricalNoteRowInput,
  ProspectusHistoricalNoteTable,
} from "./prospectus-historical-note-table.types";

export const SAMPLE_PROSPECTUS_CURRENT_NOTE_ID = "note-current-prospectus";
export const SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID = "org-issuer-sample-001";

export const SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS: ProspectusHistoricalNoteRowInput[] = [
  {
    id: "note-hist-repaid-001",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20240110-AAAA1111",
    noteStatus: "REPAID",
    productName: "Accounts Receivable Financing-i",
    fundedAmount: 500_000,
    targetAmount: 500_000,
    profitRatePercent: 12,
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
    repaidAt: "2025-02-12T00:00:00.000Z",
    updatedAt: "2025-02-12T00:00:00.000Z",
  },
  {
    id: "note-hist-active-002",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20250301-BBBB2222",
    noteStatus: "ACTIVE",
    productName: "Accounts Receivable Financing-i",
    fundedAmount: 400_000,
    targetAmount: 450_000,
    profitRatePercent: 11,
    listingOpensAt: "2025-03-01T00:00:00.000Z",
    maturityDate: "2025-06-29T00:00:00.000Z",
    repaidAt: null,
    updatedAt: "2025-03-20T00:00:00.000Z",
  },
  {
    id: "note-hist-arrears-003",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20240201-CCCC3333",
    noteStatus: "ARREARS",
    productName: "Accounts Receivable Financing-i",
    fundedAmount: 200_000,
    targetAmount: 200_000,
    profitRatePercent: 10,
    listingOpensAt: "2024-02-01T00:00:00.000Z",
    maturityDate: "2024-05-31T00:00:00.000Z",
    repaidAt: null,
    updatedAt: "2024-06-01T00:00:00.000Z",
  },
  {
    id: "note-hist-defaulted-004",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20231101-DDDD4444",
    noteStatus: "DEFAULTED",
    productName: "Accounts Receivable Financing-i",
    fundedAmount: 150_000,
    targetAmount: 150_000,
    profitRatePercent: 9,
    listingOpensAt: "2023-11-01T00:00:00.000Z",
    maturityDate: "2024-02-29T00:00:00.000Z",
    repaidAt: null,
    updatedAt: "2024-03-01T00:00:00.000Z",
  },
  {
    id: "note-hist-extra-005",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20230101-EEEE5555",
    noteStatus: "REPAID",
    productName: "Accounts Receivable Financing-i",
    fundedAmount: 100_000,
    targetAmount: 100_000,
    profitRatePercent: 8,
    listingOpensAt: "2023-01-01T00:00:00.000Z",
    maturityDate: "2023-04-01T00:00:00.000Z",
    repaidAt: "2023-03-30T00:00:00.000Z",
    updatedAt: "2023-03-30T00:00:00.000Z",
  },
  {
    id: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-20250515-0187ABCD",
    noteStatus: "PUBLISHED",
    productName: "Accounts Receivable Financing-i",
    fundedAmount: 0,
    targetAmount: 500_000,
    profitRatePercent: 12,
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
    repaidAt: null,
    updatedAt: "2025-05-15T00:00:00.000Z",
  },
  {
    id: "note-draft",
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    noteReference: "NOTE-DRAFT-0001",
    noteStatus: "DRAFT",
    productName: "Accounts Receivable Financing-i",
    fundedAmount: 0,
    profitRatePercent: 12,
    listingOpensAt: null,
    maturityDate: null,
    repaidAt: null,
    updatedAt: "2025-05-01T00:00:00.000Z",
  },
];

export const SAMPLE_PROSPECTUS_HISTORICAL_NOTE_TABLE: ProspectusHistoricalNoteTable =
  buildProspectusHistoricalNoteTable(SAMPLE_PROSPECTUS_HISTORICAL_NOTE_ROW_INPUTS, {
    issuerOrganizationId: SAMPLE_PROSPECTUS_ISSUER_ORGANIZATION_ID,
    currentNoteId: SAMPLE_PROSPECTUS_CURRENT_NOTE_ID,
  });
