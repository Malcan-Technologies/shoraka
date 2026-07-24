/**
 * SECTION: Sample Issuer Fundamentals Highlight for Stage 5B preview
 * WHY: Realistic unaudited year keys + metrics for audit tests; claims stay DNA
 */

import { buildProspectusIssuerFundamentalsHighlight } from "./prospectus-issuer-fundamentals-highlight";
import type {
  ProspectusIssuerFundamentalsHighlight,
  ProspectusIssuerFundamentalsHighlightInput,
} from "./prospectus-issuer-fundamentals-highlight.types";

/** Illustrative unaudited_by_year keys and observed metrics — not Canva marketing copy. */
export const SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_INPUT: ProspectusIssuerFundamentalsHighlightInput =
  {
    financialYearsAvailable: ["2025", "2026"],
    yearMetricsObserved: [
      {
        year: "2025",
        turnover: 12_000_000,
        plnpat: 900_000,
        plnpbt: 1_100_000,
        profitMargin: 0.075,
        gearing: 0.35,
        currentRatio: 1.8,
      },
      {
        year: "2026",
        turnover: 13_500_000,
        plnpat: 1_050_000,
        plnpbt: 1_250_000,
        profitMargin: 0.078,
        gearing: 0.32,
        currentRatio: 1.9,
      },
    ],
  };

export const SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT: ProspectusIssuerFundamentalsHighlight =
  buildProspectusIssuerFundamentalsHighlight(
    SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_INPUT
  );
