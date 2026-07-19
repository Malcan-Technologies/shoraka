/**
 * SECTION: Build Paymaster Investor Highlight view-model
 * WHY: Reuse Stage 2 paymaster formatting; never invent government/track-record claims
 */

import { buildProspectusDatesPaymaster } from "./prospectus-dates-paymaster";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAYMASTER_HIGHLIGHT_AUDIT,
  type ProspectusPaymasterHighlight,
  type ProspectusPaymasterHighlightInput,
} from "./prospectus-paymaster-highlight.types";

export function buildProspectusPaymasterHighlight(
  input: ProspectusPaymasterHighlightInput
): ProspectusPaymasterHighlight {
  // Observational Note repayment must not invent paymaster history.
  void input.noteRepaymentObserved;

  const paymaster = buildProspectusDatesPaymaster({
    listingOpensAt: null,
    maturityDate: null,
    paymasterName: input.paymasterName,
    paymasterEntityType: input.paymasterEntityType,
  });

  return {
    paymasterName: paymaster.paymasterName,
    paymasterEntityType: paymaster.paymasterEntityType,
    governmentClassification: PROSPECTUS_DATA_NOT_AVAILABLE,
    paymasterPaymentTrackRecord: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightTitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_PAYMASTER_HIGHLIGHT_AUDIT,
  };
}
