/**
 * SECTION: Sample Dates & Paymaster inputs/values for Stage 2 preview
 * WHY: opens_at → closes_at listing window; opens_at → maturity = 120 days; entity_type labels
 */

import { buildProspectusDatesPaymaster } from "./prospectus-dates-paymaster";
import type {
  ProspectusDatesPaymaster,
  ProspectusDatesPaymasterInput,
} from "./prospectus-dates-paymaster.types";

/** Raw sample: listing 15 May, scheduled close 30 May, maturity 12 Sept 2025. */
export const SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT: ProspectusDatesPaymasterInput = {
  listingOpensAt: "2025-05-15T00:00:00.000Z",
  listingClosesAt: "2025-05-30T00:00:00.000Z",
  maturityDate: "2025-09-12T00:00:00.000Z",
  paymasterName: "Kementerian Kerja Raya (KKR)",
  /** Exact issuer ENTITY_TYPES option (display-ready). */
  paymasterEntityType: "Federal Government Agency",
};

export const SAMPLE_PROSPECTUS_DATES_PAYMASTER: ProspectusDatesPaymaster =
  buildProspectusDatesPaymaster(SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT);
