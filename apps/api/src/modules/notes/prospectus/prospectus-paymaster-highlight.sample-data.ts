/**
 * SECTION: Sample Paymaster Highlight for Stage 5A preview
 * WHY: Same frozen snapshot sample as Stage 2; highlight claims stay unavailable
 */

import { SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT } from "./prospectus-dates-paymaster.sample-data";
import { buildProspectusPaymasterHighlight } from "./prospectus-paymaster-highlight";
import type {
  ProspectusPaymasterHighlight,
  ProspectusPaymasterHighlightInput,
} from "./prospectus-paymaster-highlight.types";

export const SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT: ProspectusPaymasterHighlightInput = {
  paymasterName: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.paymasterName,
  paymasterEntityType: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.paymasterEntityType,
};

export const SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT: ProspectusPaymasterHighlight =
  buildProspectusPaymasterHighlight(SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT);
