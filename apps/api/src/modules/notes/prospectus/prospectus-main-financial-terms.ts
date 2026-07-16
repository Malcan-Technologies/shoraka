/**
 * SECTION: Build Main Financial Terms view-model
 * WHY: Format confirmed money/rate fields only; period return stays unresolved
 */

import {
  formatInvestorReturnRatePercent,
  MARKETPLACE_MIN_COMMIT_MYR,
  NOTE_MONEY_DECIMALS,
  roundNoteMoney,
} from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusMainFinancialTerms,
  type ProspectusMainFinancialTermsInput,
} from "./prospectus-main-financial-terms.types";

/** Match packages/config formatCurrency (RM + en-MY, 2dp) without adding a config dependency. */
export function formatProspectusMoneyMyr(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  const rounded = roundNoteMoney(amount, NOTE_MONEY_DECIMALS);
  const formatted = rounded.toLocaleString("en-MY", {
    minimumFractionDigits: NOTE_MONEY_DECIMALS,
    maximumFractionDigits: NOTE_MONEY_DECIMALS,
  });
  return `RM ${formatted}`;
}

export function formatProspectusProfitRatePa(
  profitRatePercent: number | null | undefined
): string {
  if (profitRatePercent == null || !Number.isFinite(profitRatePercent)) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  const rateLabel = formatInvestorReturnRatePercent(profitRatePercent);
  if (rateLabel === "-") {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  return `${rateLabel} p.a.`;
}

export function buildProspectusMainFinancialTerms(
  input: ProspectusMainFinancialTermsInput
): ProspectusMainFinancialTerms {
  return {
    financingAmount: formatProspectusMoneyMyr(input.targetAmount),
    minimumInvestment: formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR),
    profitRate: formatProspectusProfitRatePa(input.profitRatePercent),
    expectedReturnForInvestmentPeriod: PROSPECTUS_DATA_NOT_AVAILABLE,
  };
}
