/**
 * SECTION: Sample Dates & Paymaster inputs/values for Stage 2 preview
 * WHY: Prove opens_at + maturity_date → 120-day tenure; real entity_type labels
 */

import { buildProspectusDatesPaymaster } from "./prospectus-dates-paymaster";
import type {
  ProspectusDatesPaymaster,
  ProspectusDatesPaymasterInput,
} from "./prospectus-dates-paymaster.types";

/** Raw sample matching Canva span (15 May 2025 → 12 September 2025). */
export const SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT: ProspectusDatesPaymasterInput = {
  listingOpensAt: "2025-05-15T00:00:00.000Z",
  maturityDate: "2025-09-12T00:00:00.000Z",
  paymasterName: "Kementerian Kerja Raya (KKR)",
  /** Exact issuer ENTITY_TYPES option (display-ready). */
  paymasterEntityType: "Federal Government Agency",
};

export const SAMPLE_PROSPECTUS_DATES_PAYMASTER: ProspectusDatesPaymaster =
  buildProspectusDatesPaymaster(SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT);
