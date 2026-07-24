/**
 * SECTION: Sample Return Highlight for Stage 5C preview
 * WHY: Same 12% gross + 120-day span as Stages 2/4A; 15% service fee → 10.2% annual net
 */

import { SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT } from "./prospectus-dates-paymaster.sample-data";
import { SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT } from "./prospectus-main-financial-terms.sample-data";
import { buildProspectusReturnHighlight } from "./prospectus-return-highlight";
import type {
  ProspectusReturnHighlight,
  ProspectusReturnHighlightInput,
} from "./prospectus-return-highlight.types";

export const SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT: ProspectusReturnHighlightInput = {
  profitRatePercent: SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT.profitRatePercent,
  listingOpensAt: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.listingOpensAt,
  maturityDate: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.maturityDate,
  /** Product default / common note service fee on gross profit. */
  serviceFeeRatePercent: 15,
};

export const SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT: ProspectusReturnHighlight =
  buildProspectusReturnHighlight(SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT);
