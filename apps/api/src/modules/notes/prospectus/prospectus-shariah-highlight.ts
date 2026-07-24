/**
 * SECTION: Build Shariah Investor Highlight view-model
 * WHY: Reuse Stage 4C principle DNA; never invent compliance/title from Tawarruq or marketing
 */

import { buildProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_SHARIAH_HIGHLIGHT_AUDIT,
  type ProspectusShariahHighlight,
  type ProspectusShariahHighlightInput,
} from "./prospectus-shariah-highlight.types";

export function buildProspectusShariahHighlight(
  input: ProspectusShariahHighlightInput = {}
): ProspectusShariahHighlight {
  // Observational marketing / Shoraka labels must not invent status.
  void input.marketingShariahCompliantLabel;
  void input.shorakaStatus;

  const stage4c = buildProspectusPaymentBasisShariah(input);

  return {
    shariahCompliantStatus: PROSPECTUS_DATA_NOT_AVAILABLE,
    specificShariahPrinciple: stage4c.shariahPrinciple,
    evidenceSource: PROSPECTUS_DATA_NOT_AVAILABLE,
    approvalOrAdviserReference: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightTitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_SHARIAH_HIGHLIGHT_AUDIT,
  };
}
