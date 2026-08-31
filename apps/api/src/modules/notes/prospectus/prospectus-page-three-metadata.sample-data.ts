/**
 * SECTION: Sample Page 3 Stage 1 metadata inputs
 * WHY: Deterministic Canva-facing preview; reuse Page 2 Stage 4A sample source
 */

import { SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE } from "./prospectus-financial-comparison-source.sample-data";
import { buildProspectusPageThreeMetadata } from "./prospectus-page-three-metadata";
import type {
  ProspectusPageThreeMetadata,
  ProspectusPageThreeMetadataInput,
} from "./prospectus-page-three-metadata.types";

export const SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT: ProspectusPageThreeMetadataInput =
  {
    issuerName: "ABC Engineering Sdn Bhd",
    issuerSector: "Construction",
    officerCompanySize: "Medium",
    selectedRiskRating: "SME-3",
    paymasterName: "Kementerian Kerja Raya",
    financialSource: SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE,
    liveOrganizationName: "LIVE ORG MUST NOT APPEAR",
    livePaymasterName: "LIVE PAYMASTER MUST NOT APPEAR",
    ctosFinancials: {
      financials: [{ financial_year: 2020, turnover: 9_999_999 }],
    },
  };

export const SAMPLE_PROSPECTUS_PAGE_THREE_METADATA: ProspectusPageThreeMetadata =
  buildProspectusPageThreeMetadata(SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT);
