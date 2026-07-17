/**
 * SECTION: Sample Shariah Highlight for Stage 5D preview
 * WHY: All claim fields unavailable — proves DNA, not Canva or landing marketing
 */

import { buildProspectusShariahHighlight } from "./prospectus-shariah-highlight";
import type {
  ProspectusShariahHighlight,
  ProspectusShariahHighlightInput,
} from "./prospectus-shariah-highlight.types";

export const SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT_INPUT: ProspectusShariahHighlightInput = {};

export const SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT: ProspectusShariahHighlight =
  buildProspectusShariahHighlight(SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT_INPUT);
