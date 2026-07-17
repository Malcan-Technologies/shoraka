/**
 * SECTION: Build Return Investor Highlight view-model
 * WHY: Reuse Stage 2 tenure + Stage 4A rate format; net annual via shared helper; no marketing claims
 */

import {
  computeNetExpectedReturnRatePercent,
  formatInvestorReturnRatePercent,
} from "@cashsouk/types";
import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import { formatProspectusProfitRatePa } from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusReturnHighlight,
  type ProspectusReturnHighlightInput,
} from "./prospectus-return-highlight.types";

function formatAnnualNetRatePa(
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
  return `${rateLabel} p.a.`;
}

export function buildProspectusReturnHighlight(
  input: ProspectusReturnHighlightInput
): ProspectusReturnHighlight {
  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: input.listingOpensAt,
    maturityDate: input.maturityDate,
  });

  return {
    annualGrossProfitRate: formatProspectusProfitRatePa(input.profitRatePercent),
    tenure: timing.tenure,
    netOrAfterFeeRate: formatAnnualNetRatePa(
      input.profitRatePercent,
      input.serviceFeeRatePercent
    ),
    returnClassification: PROSPECTUS_DATA_NOT_AVAILABLE,
    tenureClassification: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightTitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    claimApprovalStatus: PROSPECTUS_DATA_NOT_AVAILABLE,
  };
}
