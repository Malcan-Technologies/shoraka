/**
 * SECTION: Build At a Glance view-model
 * WHY: Compose Stage 4A financial terms + Stage 2 tenure — no duplicate formatters
 */

import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import { buildProspectusMainFinancialTerms } from "./prospectus-main-financial-terms";
import type {
  ProspectusAtAGlance,
  ProspectusAtAGlanceInput,
} from "./prospectus-at-a-glance.types";

export function buildProspectusAtAGlance(input: ProspectusAtAGlanceInput): ProspectusAtAGlance {
  const terms = buildProspectusMainFinancialTerms({
    targetAmount: input.targetAmount,
    profitRatePercent: input.profitRatePercent,
  });
  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: input.listingOpensAt,
    maturityDate: input.maturityDate,
  });

  return {
    financingAmount: terms.financingAmount,
    profitRate: terms.profitRate,
    expectedReturn: terms.expectedReturnForInvestmentPeriod,
    tenure: timing.tenure,
    minimumInvestment: terms.minimumInvestment,
  };
}
