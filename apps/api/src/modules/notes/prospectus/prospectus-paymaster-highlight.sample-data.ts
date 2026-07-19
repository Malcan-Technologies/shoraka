/**
 * SECTION: Sample Paymaster Highlight for Stage 5A preview
 * WHY: Real frozen name/entity; unsupported claims stay Data not available
 */

import { buildProspectusPaymasterHighlight } from "./prospectus-paymaster-highlight";
import type {
  ProspectusPaymasterHighlight,
  ProspectusPaymasterHighlightInput,
} from "./prospectus-paymaster-highlight.types";

export const SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT: ProspectusPaymasterHighlightInput = {
  paymasterName: "Kementerian Kerja Raya",
  /** Exact issuer ENTITY_TYPES display-ready label. */
  paymasterEntityType: "Federal Government Agency",
  /** Observational only — must not invent paymaster track record. */
  noteRepaymentObserved: {
    noteStatus: "REPAID",
    repaidAt: "2025-09-12T00:00:00.000Z",
    receivedPayoutAmount: 500_000,
  },
};

export const SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT: ProspectusPaymasterHighlight =
  buildProspectusPaymasterHighlight(SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT);
