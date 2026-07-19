/**
 * SECTION: Deterministic Page 3 sample assembly (no Prisma)
 * WHY: Preview without --note-id; prove Stages 1–6 composition and DNA fields
 */

import { SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SOURCE } from "./prospectus-page-three-balance-sheet.sample-data";
import {
  buildProspectusPageThree,
  type ProspectusPageThreeBuilderInput,
} from "./prospectus-page-three-mapper";
import type { ProspectusPageThree } from "./prospectus-page-three.types";
import { PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT } from "./prospectus-placeholder-publication-content";

export const SAMPLE_PROSPECTUS_PAGE_THREE_INPUT: ProspectusPageThreeBuilderInput = {
  noteId: "clsamplepage3preview001",
  isPublished: false,
  financialMode: "live_unpublished_preview",
  issuerSnapshot: {
    name: "ABC Engineering Sdn Bhd",
    registration_number: "202001234567",
    industry: "Construction",
    country: "Malaysia",
    business_description: "Civil engineering and infrastructure works.",
  },
  invoiceSnapshot: {
    details: { value: 625000 },
    offer_details: { risk_rating: "AA" },
  },
  paymasterSnapshot: {
    name: "Kementerian Kerja Raya",
    entity_type: "GOVERNMENT",
  },
  liveFinancialStatements: {
    questionnaire: { financial_year_end: "2024-12-31" },
    unaudited_by_year: Object.fromEntries(
      SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SOURCE.years.map((year) => [
        String(year.year),
        {
          ...year.rawFinancials,
          turnover:
            year.year === 2022
              ? 13_900_000
              : year.year === 2023
                ? 16_200_000
                : 18_600_000,
          plnpbt:
            year.year === 2022 ? 1_400_000 : year.year === 2023 ? 1_700_000 : 2_000_000,
          plnpat:
            year.year === 2022 ? 1_200_000 : year.year === 2023 ? 1_500_000 : 1_800_000,
          bsqpuc: 2_000_000,
        },
      ])
    ),
  },
  frozenFinancialComparison: null,
  publicationContent: PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT,
};

export const SAMPLE_PROSPECTUS_PAGE_THREE: ProspectusPageThree = buildProspectusPageThree(
  SAMPLE_PROSPECTUS_PAGE_THREE_INPUT
);
