/**
 * SECTION: Deterministic Page 1 sample for preview/tests (no Prisma)
 * WHY: Stable HTML without requiring a live Note ID
 */

import { buildProspectusPageOne, type ProspectusPageOneBuilderInput } from "./prospectus-page-one-mapper";
import type { ProspectusPageOne } from "./prospectus-page-one.types";
import { PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT } from "./prospectus-placeholder-publication-content";

export const SAMPLE_PROSPECTUS_PAGE_ONE_INPUT: ProspectusPageOneBuilderInput = {
  noteId: "sample-note-page-one",
  noteIdentity: {
    noteReference: "NOTE-20250515-SAMPLE001",
    productSnapshotProductName: "Accounts Receivable Financing-i",
    productSnapshotDescription:
      "Short-term financing against approved receivables under the CashSouk marketplace.",
    liveProductDescription: null,
  },
  datesPaymaster: {
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    listingClosesAt: "2025-05-29T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
    paymasterName: "Ministry of Finance Malaysia",
    paymasterEntityType: "Federal Government Agency",
  },
  riskAssessment: {
    soukscoreRiskRating: "A",
  },
  mainFinancialTerms: {
    targetAmount: 500_000,
    profitRatePercent: 12,
    serviceFeeRatePercent: 10,
  },
  publicationContent: PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT,
  timingPurpose: {
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
    purposeSnapshotFinancingFor: "Working capital for approved receivables",
    liveApplicationFinancingFor: null,
  },
  paymentBasisShariah: {},
  paymasterHighlight: {
    paymasterName: "Ministry of Finance Malaysia",
    paymasterEntityType: "Federal Government Agency",
  },
  issuerFundamentalsHighlight: {
    financialYearsAvailable: [],
  },
  returnHighlight: {
    profitRatePercent: 12,
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
    serviceFeeRatePercent: 10,
  },
  trackRecordMode: "frozen_publication_snapshot",
  page1TrackRecordSnapshot: {
    issuer_track_record: {
      total_notes_funded: 3,
      total_amount_funded: "3450000",
      successful_repayment_percent: 100,
      on_time_payment_rate_six_months_percent: 95,
      calculated_at: "2025-05-15T00:00:00.000Z",
    },
    historical_notes: [
      {
        note_id: "hist-1",
        note_reference: "NOTE-20240110-AAAA1111",
        financing_type: "Accounts Receivable Financing-i",
        funded_amount: "500000",
        listing_opens_at: "2025-01-10T00:00:00.000Z",
        maturity_date: "2025-05-10T00:00:00.000Z",
        profit_rate_percent: "12",
        status: "REPAID",
        repaid_at: "2025-05-09T00:00:00.000Z",
        updated_at: "2025-05-09T00:00:00.000Z",
      },
      {
        note_id: "hist-2",
        note_reference: "NOTE-20250301-BBBB2222",
        financing_type: "Accounts Receivable Financing-i",
        funded_amount: "3450000",
        listing_opens_at: "2025-03-01T00:00:00.000Z",
        maturity_date: "2025-06-29T00:00:00.000Z",
        profit_rate_percent: "11",
        status: "ACTIVE",
        repaid_at: null,
        updated_at: "2025-03-20T00:00:00.000Z",
      },
    ],
  },
};

export const SAMPLE_PROSPECTUS_PAGE_ONE: ProspectusPageOne = buildProspectusPageOne(
  SAMPLE_PROSPECTUS_PAGE_ONE_INPUT
);
