/**
 * SECTION: Build Issuer Fundamentals Highlight view-model
 * WHY: Keep FS years in audit; never invent strong/healthy/conservative claims
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_DOCUMENTED_FINANCIAL_CALCULATORS,
  PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE,
  PROSPECTUS_ISSUER_FUNDAMENTALS_CLAIMS_REQUIRING_APPROVAL,
  type ProspectusIssuerFundamentalsHighlight,
  type ProspectusIssuerFundamentalsHighlightInput,
} from "./prospectus-issuer-fundamentals-highlight.types";

/**
 * Trim non-empty year keys. Preserve caller order.
 * No numeric sort — no shared prospectus year-ordering rule exists.
 */
export function normalizeProspectusFinancialYearsAvailable(
  years: string[] | null | undefined
): string[] {
  if (!Array.isArray(years) || years.length === 0) return [];
  return years
    .map((y) => (typeof y === "string" ? y.trim() : ""))
    .filter((y) => y.length > 0);
}

export function buildProspectusIssuerFundamentalsHighlight(
  input: ProspectusIssuerFundamentalsHighlightInput
): ProspectusIssuerFundamentalsHighlight {
  // Observational year metrics must not invent claim labels.
  void input.yearMetricsObserved;

  const financialYearsAvailable = normalizeProspectusFinancialYearsAvailable(
    input.financialYearsAvailable
  );

  return {
    profitabilityEvidence: PROSPECTUS_DATA_NOT_AVAILABLE,
    leverageEvidence: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightTitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: {
      financialDataSource: PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE,
      financialYearsAvailable,
      sourceType: "live_application",
      isFrozen: false,
      snapshotDecision: "pending",
      profitabilityEvidence: {
        sourceStatus: "not_stored",
        classificationAllowed: false,
      },
      leverageEvidence: {
        sourceStatus: "not_stored",
        classificationAllowed: false,
      },
      highlightTitle: {
        sourceStatus: "not_stored",
        claimApprovalRequired: true,
      },
      highlightExplanation: {
        sourceStatus: "not_stored",
        claimApprovalRequired: true,
      },
      claimApproval: {
        status: "pending",
        requiredClaims: PROSPECTUS_ISSUER_FUNDAMENTALS_CLAIMS_REQUIRING_APPROVAL,
      },
      documentedCalculators: PROSPECTUS_ISSUER_DOCUMENTED_FINANCIAL_CALCULATORS,
    },
  };
}
