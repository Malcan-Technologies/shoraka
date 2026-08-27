/**
 * SECTION: Build Page 3 Stage 1 metadata + shared financial-year pass-through
 * WHY: Frozen snapshot strings + SoukScore validator; issuer identity omitted;
 *      Sector = anonymous Industry | Company Size from Page 2 sources;
 *      Paymaster/Confidence gradings reused from Page 2 officer confirmations
 */

import {
  isMarcSmeGrade,
  normalizeProspectusConfidenceGrading,
  normalizeProspectusPaymasterRating,
} from "@cashsouk/types";
import { formatProspectusIndustryAndCompanySize } from "./prospectus-industry-company-size";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_METADATA_AUDIT,
  PROSPECTUS_PAGE_THREE_PAGE_TITLE,
  type ProspectusPageThreeMetadata,
  type ProspectusPageThreeMetadataInput,
} from "./prospectus-page-three-metadata.types";
import { PROSPECTUS_DETAILED_FINANCIAL_SUBTITLE } from "./prospectus-static-copy";

function nonEmptyTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function displayString(value: unknown): string {
  return nonEmptyTrimmed(value) ?? PROSPECTUS_DATA_NOT_AVAILABLE;
}

/** @deprecated Prefer formatProspectusIndustryAndCompanySize — kept for existing imports. */
export function formatProspectusPageThreeSector(
  industry: unknown,
  companySize: unknown
): string {
  return formatProspectusIndustryAndCompanySize(industry, companySize);
}

export function buildProspectusPageThreeMetadata(
  input: ProspectusPageThreeMetadataInput
): ProspectusPageThreeMetadata {
  // Observational only — prove live org / paymaster / CTOS / issuer name never become Canva fields.
  void input.issuerName;
  void input.liveOrganizationName;
  void input.livePaymasterName;
  void input.ctosFinancials;

  const riskRating = isMarcSmeGrade(input.selectedRiskRating)
    ? input.selectedRiskRating
    : PROSPECTUS_DATA_NOT_AVAILABLE;

  const paymasterGrading =
    normalizeProspectusPaymasterRating(input.officerPaymasterRating) ??
    PROSPECTUS_DATA_NOT_AVAILABLE;
  const confidenceGrading =
    normalizeProspectusConfidenceGrading(input.officerConfidenceGrading) ??
    PROSPECTUS_DATA_NOT_AVAILABLE;

  return {
    pageTitle: PROSPECTUS_PAGE_THREE_PAGE_TITLE,
    pageSubtitle: PROSPECTUS_DETAILED_FINANCIAL_SUBTITLE,
    metadata: {
      sector: formatProspectusIndustryAndCompanySize(
        input.issuerSector,
        input.officerCompanySize
      ),
      riskRating,
      paymaster: displayString(input.paymasterName),
      paymasterGrading,
      confidenceGrading,
    },
    // Pass-through only — never re-select years or re-derive FYE in Page 3.
    financialYears: input.financialSource.years,
    audit: PROSPECTUS_PAGE_THREE_METADATA_AUDIT,
  };
}
