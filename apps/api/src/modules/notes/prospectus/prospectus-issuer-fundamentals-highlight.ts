/**
 * SECTION: Build Issuer Financial-Strength Highlight view-model
 * WHY: Document live FS source; never invent strong/healthy/conservative claims
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE,
  type ProspectusIssuerFundamentalsHighlight,
  type ProspectusIssuerFundamentalsHighlightInput,
} from "./prospectus-issuer-fundamentals-highlight.types";

function formatYearsAvailable(years: string[] | null | undefined): string {
  if (!Array.isArray(years) || years.length === 0) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  const cleaned = years
    .map((y) => (typeof y === "string" ? y.trim() : ""))
    .filter((y) => y.length > 0);
  if (cleaned.length === 0) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return cleaned.join(", ");
}

export function buildProspectusIssuerFundamentalsHighlight(
  input: ProspectusIssuerFundamentalsHighlightInput
): ProspectusIssuerFundamentalsHighlight {
  return {
    financialDataSource: PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE,
    financialYearsAvailable: formatYearsAvailable(input.financialYearsAvailable),
    profitabilityEvidence: PROSPECTUS_DATA_NOT_AVAILABLE,
    leverageEvidence: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightTitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    claimApprovalStatus: PROSPECTUS_DATA_NOT_AVAILABLE,
    dataFrozenOnNote: "No",
  };
}
