/**
 * SECTION: Sample Issuer Fundamentals Highlight for Stage 5B preview
 * WHY: Show year-key shape from unaudited_by_year; narrative claims stay unavailable
 */

import { buildProspectusIssuerFundamentalsHighlight } from "./prospectus-issuer-fundamentals-highlight";
import type {
  ProspectusIssuerFundamentalsHighlight,
  ProspectusIssuerFundamentalsHighlightInput,
} from "./prospectus-issuer-fundamentals-highlight.types";

/** Illustrative unaudited_by_year keys only — not Canva marketing copy. */
export const SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_INPUT: ProspectusIssuerFundamentalsHighlightInput =
  {
    financialYearsAvailable: ["2025", "2026"],
  };

export const SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT: ProspectusIssuerFundamentalsHighlight =
  buildProspectusIssuerFundamentalsHighlight(
    SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_INPUT
  );
