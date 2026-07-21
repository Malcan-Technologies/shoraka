/**
 * SECTION: Build Page 3 Stage 1 metadata + shared financial-year pass-through
 * WHY: Frozen snapshot strings + SoukScore validator; issuer identity omitted;
 *      Sector = anonymous Industry | Company Size from Page 2 sources;
 *      Paymaster/Confidence gradings reused from Page 2 officer confirmations
 */

import {
  isSoukscoreRiskRating,
  normalizeProspectusCompanySize,
  normalizeProspectusConfidenceGrading,
  normalizeProspectusPaymasterRating,
} from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_METADATA_AUDIT,
  PROSPECTUS_PAGE_THREE_PAGE_TITLE,
  type ProspectusPageThreeMetadata,
  type ProspectusPageThreeMetadataInput,
} from "./prospectus-page-three-metadata.types";

function nonEmptyTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function displayString(value: unknown): string {
  return nonEmptyTrimmed(value) ?? PROSPECTUS_DATA_NOT_AVAILABLE;
}

/**
 * Page 3 Sector — same anonymous classification as Page 2 About the Issuer:
 * Industry (frozen snapshot) + officer Company Size, joined with ` | `.
 */
export function formatProspectusPageThreeSector(
  industry: unknown,
  companySize: unknown
): string {
  const industryText = nonEmptyTrimmed(industry);
  const sizeText = normalizeProspectusCompanySize(companySize);
  if (industryText && sizeText) return `${industryText} | ${sizeText}`;
  if (industryText) return industryText;
  if (sizeText) return sizeText;
  return PROSPECTUS_DATA_NOT_AVAILABLE;
}

export function buildProspectusPageThreeMetadata(
  input: ProspectusPageThreeMetadataInput
): ProspectusPageThreeMetadata {
  // Observational only — prove live org / paymaster / CTOS / issuer name never become Canva fields.
  void input.issuerName;
  void input.liveOrganizationName;
  void input.livePaymasterName;
  void input.ctosFinancials;

  const riskRating = isSoukscoreRiskRating(input.selectedRiskRating)
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
    pageSubtitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    metadata: {
      sector: formatProspectusPageThreeSector(
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
