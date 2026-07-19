/**
 * SECTION: Build shared prospectus footer view-model
 * WHY: No approved short prospectus legal sentences found — DNA both fields
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusFooter,
  type ProspectusFooterInput,
} from "./prospectus-footer.types";

export function buildProspectusFooter(input: ProspectusFooterInput = {}): ProspectusFooter {
  void input.legacyCanvaRiskWarning;
  void input.legacyCanvaTermsStatement;

  return {
    investmentRiskWarning: PROSPECTUS_DATA_NOT_AVAILABLE,
    productTermsRiskDisclosureStatement: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: {
      riskWarning: {
        status: "unresolved",
        source: null,
        generatedLegalCopyAllowed: false,
      },
      termsStatement: {
        status: "unresolved",
        source: null,
        generatedLegalCopyAllowed: false,
      },
      shared: {
        reusableAcrossProspectusPages: true,
      },
      snapshot: {
        staticBrandCopyFrozenPerNote: false,
        approvedLegalCopyVersionDecision: "pending",
        approvedMarketingCopyVersionDecision: "pending",
      },
    },
  };
}
