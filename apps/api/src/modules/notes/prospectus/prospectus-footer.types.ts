/**
 * SECTION: Shared prospectus footer (Page 2 Stage 8; reusable across pages)
 * WHY: Legal copy only when exact current approved production wording exists
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusFooterAudit {
  riskWarning: {
    status: "approved_existing_copy" | "unresolved";
    source: string | null;
    generatedLegalCopyAllowed: false;
  };
  termsStatement: {
    status: "approved_existing_copy" | "unresolved";
    source: string | null;
    generatedLegalCopyAllowed: false;
  };
  shared: {
    reusableAcrossProspectusPages: true;
  };
  snapshot: {
    staticBrandCopyFrozenPerNote: false;
    approvedLegalCopyVersionDecision: "pending";
    approvedMarketingCopyVersionDecision: "pending";
  };
}

export interface ProspectusFooter {
  investmentRiskWarning: string;
  productTermsRiskDisclosureStatement: string;
  audit: ProspectusFooterAudit;
}

export interface ProspectusFooterInput {
  /** Observational Canva/legacy legal text — must not auto-approve. */
  legacyCanvaRiskWarning?: string | null;
  legacyCanvaTermsStatement?: string | null;
}
