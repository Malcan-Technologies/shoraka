/**
 * SECTION: Deterministic Page 2 sample assembly (no Prisma)
 * WHY: Preview without --note-id; prove stage composition and DNA fields
 */

import { MARKETPLACE_MIN_COMMIT_MYR } from "@cashsouk/types";
import { buildProspectusPageTwo, type ProspectusPageTwoBuilderInput } from "./prospectus-page-two-mapper";
import type { ProspectusPageTwo } from "./prospectus-page-two.types";
import { PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT } from "./prospectus-placeholder-publication-content";
import type { ProspectusPage2FinancialComparisonSnapshot } from "./prospectus-snapshot.types";

const SAMPLE_FROZEN_FINANCIALS: ProspectusPage2FinancialComparisonSnapshot = {
  source: "admin_financial_statements_normalized",
  source_footer: "Source: Audited Financial Statements",
  selected_years: [
    {
      year: 2022,
      year_label: "FY2022",
      financial_year_end_label: "31 Dec 2022",
      financial_year_end_iso: "2022-12-31",
      record_source: "ctos_audited",
      raw_financials: {
        turnover: 12000000,
        plnpat: 900000,
        bsqpuc: 5000000,
        bscatot: 4000000,
        curlib: 2000000,
        plnpbt: 1100000,
        bsfatot: 1500000,
        othass: 1000000,
        bsclbank: 900000,
        bsslltd: 500000,
        bsclstd: 200000,
        totass: null,
        totlib: null,
        profit_margin: null,
        return_on_equity: null,
        currat: null,
      },
    },
    {
      year: 2023,
      year_label: "FY2023",
      financial_year_end_label: "31 Dec 2023",
      financial_year_end_iso: "2023-12-31",
      record_source: "ctos_audited",
      raw_financials: {
        turnover: 13900000,
        plnpat: 1100000,
        bsqpuc: 5500000,
        bscatot: 4200000,
        curlib: 2100000,
        plnpbt: 1300000,
        bsfatot: 1600000,
        othass: 1100000,
        bsclbank: 950000,
        bsslltd: 550000,
        bsclstd: 250000,
        totass: null,
        totlib: null,
        profit_margin: null,
        return_on_equity: null,
        currat: null,
      },
    },
    {
      year: 2024,
      year_label: "FY2024",
      financial_year_end_label: "31 Dec 2024",
      financial_year_end_iso: "2024-12-31",
      record_source: "ctos_audited",
      raw_financials: {
        turnover: 15000000,
        plnpat: 1200000,
        bsqpuc: 6000000,
        bscatot: 4500000,
        curlib: 2200000,
        plnpbt: 1400000,
        bsfatot: 1700000,
        othass: 1200000,
        bsclbank: 1000000,
        bsslltd: 600000,
        bsclstd: 300000,
        totass: null,
        totlib: null,
        profit_margin: null,
        return_on_equity: null,
        currat: null,
      },
    },
  ],
  calculated_at: "2026-07-19T00:00:00.000Z",
};

export const SAMPLE_PROSPECTUS_PAGE_TWO_INPUT: ProspectusPageTwoBuilderInput = {
  noteId: "clsamplepage2preview001",
  noteReference: "CS-NOTE-P2-SAMPLE",
  isPublished: true,
  financialMode: "frozen_publication_snapshot",
  issuerSnapshot: {
    name: "Sample Issuer Sdn Bhd",
    registration_number: "202001234567",
    industry: "Construction",
    entity_type: "PRIVATE_LIMITED",
    country: "Malaysia",
    business_description:
      "Sample Issuer Sdn Bhd — Civil engineering and infrastructure works.",
  },
  invoiceSnapshot: {
    details: { value: 625000 },
    offer_details: { risk_rating: "B" },
  },
  paymasterSnapshot: {
    name: "Sample Paymaster Berhad",
    entity_type: "GOVERNMENT_LINKED",
  },
  maturityDate: new Date("2026-12-31T00:00:00.000Z"),
  liveFinancialStatements: null,
  liveCtosFinancials: null,
  frozenFinancialComparison: SAMPLE_FROZEN_FINANCIALS,
  publicationContent: PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT,
};

export const SAMPLE_PROSPECTUS_PAGE_TWO: ProspectusPageTwo = buildProspectusPageTwo(
  SAMPLE_PROSPECTUS_PAGE_TWO_INPUT
);

export const SAMPLE_PROSPECTUS_PAGE_TWO_MIN_INVESTMENT_MYR = MARKETPLACE_MIN_COMMIT_MYR;
