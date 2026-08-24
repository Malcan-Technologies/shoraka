/**
 * SECTION: Build Return Investor Highlight view-model
 * WHY: Reuse Stage 4A gross + Stage 2 tenure; annual net via shared helper; no period/marketing claims
 */

import {
  computeNetExpectedReturnRatePercent,
  formatInvestorReturnRatePercent,
} from "@cashsouk/types";
import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import { buildProspectusMainFinancialTerms } from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_RETURN_HIGHLIGHT_AUDIT_BASE,
  type ProspectusReturnHighlight,
  type ProspectusReturnHighlightInput,
} from "./prospectus-return-highlight.types";

/**
 * Annual net expected return after service fee on gross profit.
 * Requires both rates to be finite — do not treat missing fee as 0 here
 * (shared helper would coerce null fee to 0).
 * Label already includes "(p.a.)", so value is percent only.
 */
function formatAnnualNetExpectedReturnRate(
  profitRatePercent: number | null | undefined,
  serviceFeeRatePercent: number | null | undefined
): string {
  if (profitRatePercent == null || !Number.isFinite(profitRatePercent)) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  if (serviceFeeRatePercent == null || !Number.isFinite(serviceFeeRatePercent)) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  const net = computeNetExpectedReturnRatePercent(profitRatePercent, serviceFeeRatePercent);
  if (net == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const rateLabel = formatInvestorReturnRatePercent(net);
  if (rateLabel === "-") return PROSPECTUS_DATA_NOT_AVAILABLE;
  return rateLabel;
}

export function buildProspectusReturnHighlight(
  input: ProspectusReturnHighlightInput
): ProspectusReturnHighlight {
  const terms = buildProspectusMainFinancialTerms({
    targetAmount: null,
    profitRatePercent: input.profitRatePercent,
    serviceFeeRatePercent: input.serviceFeeRatePercent,
  });
  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: input.listingOpensAt,
    maturityDate: input.maturityDate,
    tenureDays: input.tenureDays,
  });

  return {
    annualGrossProfitRate: terms.profitRate,
    tenure: timing.tenure,
    annualNetExpectedReturnRate: formatAnnualNetExpectedReturnRate(
      input.profitRatePercent,
      input.serviceFeeRatePercent
    ),
    expectedReturnForInvestmentPeriod: terms.expectedReturnForInvestmentPeriod,
    returnClassification: PROSPECTUS_DATA_NOT_AVAILABLE,
    tenureClassification: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightTitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_RETURN_HIGHLIGHT_AUDIT_BASE,
  };
}
