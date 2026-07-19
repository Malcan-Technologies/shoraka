/**
 * SECTION: Sample Timing & Purpose for Stage 4B preview
 * WHY: Same date span as Stage 2; purpose is real free-text style — not Canva "Working Capital"
 */

import { buildProspectusTimingPurpose } from "./prospectus-timing-purpose";
import type {
  ProspectusTimingPurpose,
  ProspectusTimingPurposeInput,
} from "./prospectus-timing-purpose.types";

export const SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT: ProspectusTimingPurposeInput = {
  listingOpensAt: "2025-05-15T00:00:00.000Z",
  maturityDate: "2025-09-12T00:00:00.000Z",
  /** Illustrative financing_for free text (live Application field). */
  purposeOfFinancing:
    "To finance purchase of raw materials and working capital requirements",
};

export const SAMPLE_PROSPECTUS_TIMING_PURPOSE: ProspectusTimingPurpose =
  buildProspectusTimingPurpose(SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT);
