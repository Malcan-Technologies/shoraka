/**
 * SECTION: Sample Main Financial Terms for Stage 4A preview
 * WHY: Realistic target + gross profit rate; period return intentionally unavailable
 */

import { buildProspectusMainFinancialTerms } from "./prospectus-main-financial-terms";
import type {
  ProspectusMainFinancialTerms,
  ProspectusMainFinancialTermsInput,
} from "./prospectus-main-financial-terms.types";

export const SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT: ProspectusMainFinancialTermsInput = {
  targetAmount: 500_000,
  profitRatePercent: 12,
  serviceFeeRatePercent: 10,
};

export const SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS: ProspectusMainFinancialTerms =
  buildProspectusMainFinancialTerms(SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT);
