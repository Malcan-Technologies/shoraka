/**
 * SECTION: Build Main Financial Terms view-model
 * WHY: One canonical source per confirmed field; expected return = portal net p.a. helper
 */

import {
  formatInvestorReturnRatePercent,
  MARKETPLACE_MIN_COMMIT_MYR,
  NOTE_MONEY_DECIMALS,
  resolveNetExpectedReturnRatePercent,
  roundNoteMoney,
} from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_EXPECTED_RETURN_AUDIT,
  type ProspectusMainFinancialTerms,
  type ProspectusMainFinancialTermsInput,
} from "./prospectus-main-financial-terms.types";

/**
 * Match packages/config formatCurrency (RM + en-MY, 2dp).
 * Keep 2 decimals — platform NOTE_MONEY_DECIMALS; do not switch to Canva 0dp here.
 */
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

/**
 * Annual gross percent for labels that already include "(p.a.)".
 * Reuses formatInvestorReturnRatePercent (1dp investor convention).
 */
export function formatProspectusProfitRatePercent(
  profitRatePercent: number | null | undefined
): string {
  if (profitRatePercent == null || !Number.isFinite(profitRatePercent)) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  const rateLabel = formatInvestorReturnRatePercent(profitRatePercent);
  if (rateLabel === "-") {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  return rateLabel;
}

/**
 * Percent + " p.a." for stages whose label does not already say p.a.
 * Stages 5C / 8 reuse this helper directly.
 */
export function formatProspectusProfitRatePa(
  profitRatePercent: number | null | undefined
): string {
  const rateLabel = formatProspectusProfitRatePercent(profitRatePercent);
  if (rateLabel === PROSPECTUS_DATA_NOT_AVAILABLE) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  return `${rateLabel} p.a.`;
}

/** Portal-consistent Expected Return (p.a.) — net after service fee. */
export function formatProspectusExpectedReturnPa(
  profitRatePercent: number | null | undefined,
  serviceFeeRatePercent: number | null | undefined
): string {
  const net = resolveNetExpectedReturnRatePercent({
    profitRatePercent,
    serviceFeeRatePercent,
  });
  if (net == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const rateLabel = formatInvestorReturnRatePercent(net);
  if (rateLabel === "-") return PROSPECTUS_DATA_NOT_AVAILABLE;
  return rateLabel;
}

export function buildProspectusMainFinancialTerms(
  input: ProspectusMainFinancialTermsInput
): ProspectusMainFinancialTerms {
  return {
    financingAmount: formatProspectusMoneyMyr(input.targetAmount),
    minimumInvestment: formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR),
    profitRate: formatProspectusProfitRatePercent(input.profitRatePercent),
    expectedReturnForInvestmentPeriod: formatProspectusExpectedReturnPa(
      input.profitRatePercent,
      input.serviceFeeRatePercent
    ),
    audit: {
      expectedReturn: PROSPECTUS_EXPECTED_RETURN_AUDIT,
    },
  };
}
