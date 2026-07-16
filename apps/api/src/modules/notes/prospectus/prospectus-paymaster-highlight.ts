/**
 * SECTION: Build Paymaster Investor Highlight view-model
 * WHY: Reuse Stage 2 paymaster formatting; never invent government/track-record claims
 */

import { buildProspectusDatesPaymaster } from "./prospectus-dates-paymaster";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusPaymasterHighlight,
  type ProspectusPaymasterHighlightInput,
} from "./prospectus-paymaster-highlight.types";

export function buildProspectusPaymasterHighlight(
  input: ProspectusPaymasterHighlightInput
): ProspectusPaymasterHighlight {
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
    claimApprovalStatus: PROSPECTUS_DATA_NOT_AVAILABLE,
  };
}
