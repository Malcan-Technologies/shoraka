/**
 * SECTION: Sample Shariah Highlight for Stage 5D preview
 * WHY: Include Tawarruq/Shoraka/marketing observations; Canva-facing fields stay DNA
 */

import { SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH_INPUT } from "./prospectus-payment-basis-shariah.sample-data";
import { buildProspectusShariahHighlight } from "./prospectus-shariah-highlight";
import type {
  ProspectusShariahHighlight,
  ProspectusShariahHighlightInput,
} from "./prospectus-shariah-highlight.types";

/**
 * Operational + marketing observations only — none become Canva-facing claims.
 */
export const SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT_INPUT: ProspectusShariahHighlightInput = {
  ...SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH_INPUT,
  marketingShariahCompliantLabel: "Shariah Compliant",
  shorakaStatus: "STP_COMPLETED",
};

export const SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT: ProspectusShariahHighlight =
  buildProspectusShariahHighlight(SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT_INPUT);
