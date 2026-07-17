/**
 * SECTION: Sample At a Glance for Stage 6 preview
 * WHY: Same inputs as Stage 4A + Stage 2 samples so values match those sections
 */

import { SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT } from "./prospectus-dates-paymaster.sample-data";
import { SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT } from "./prospectus-main-financial-terms.sample-data";
import { buildProspectusAtAGlance } from "./prospectus-at-a-glance";
import type {
  ProspectusAtAGlance,
  ProspectusAtAGlanceInput,
} from "./prospectus-at-a-glance.types";

export const SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT: ProspectusAtAGlanceInput = {
  targetAmount: SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT.targetAmount,
  profitRatePercent: SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT.profitRatePercent,
  listingOpensAt: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.listingOpensAt,
  maturityDate: SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.maturityDate,
};

export const SAMPLE_PROSPECTUS_AT_A_GLANCE: ProspectusAtAGlance = buildProspectusAtAGlance(
  SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT
);
