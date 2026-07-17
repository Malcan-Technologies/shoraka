/**
 * SECTION: Build Shariah Investor Highlight view-model
 * WHY: Broader compliance claim unresolved; reuse Stage 4C principle DNA; never invent status
 */

import { buildProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusShariahHighlight,
  type ProspectusShariahHighlightInput,
} from "./prospectus-shariah-highlight.types";

export function buildProspectusShariahHighlight(
  _input: ProspectusShariahHighlightInput = {}
): ProspectusShariahHighlight {
  const stage4c = buildProspectusPaymentBasisShariah({});

  return {
    shariahCompliantStatus: PROSPECTUS_DATA_NOT_AVAILABLE,
    specificShariahPrinciple: stage4c.shariahPrinciple,
    evidenceSource: PROSPECTUS_DATA_NOT_AVAILABLE,
    approvalOrAdviserReference: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightTitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    claimApprovalStatus: PROSPECTUS_DATA_NOT_AVAILABLE,
    frozenOnNote: "No",
  };
}
