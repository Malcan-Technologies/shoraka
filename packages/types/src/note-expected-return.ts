/** Investor-facing expected return after deducting service fee from gross profit. */

/** Shown on marketplace and investment cards; one decimal is sufficient for investors. */
export const INVESTOR_RETURN_RATE_DISPLAY_DECIMALS = 1;

export function roundNoteMoney(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Safe label for UI (avoids floating-point artifacts like 15.299999999999998%). */
export function formatInvestorReturnRatePercent(
  rate: number | null | undefined,
  decimalPlaces = INVESTOR_RETURN_RATE_DISPLAY_DECIMALS
): string {
  if (rate == null) return "-";
  const rounded = roundNoteMoney(rate, decimalPlaces);
  return `${rounded.toFixed(decimalPlaces)}%`;
}

/**
 * Net annual return rate investors receive after service fee on gross profit.
 * Matches settlement: investorProfitNet = grossProfit * (1 - serviceFeeRate/100).
 */
export function computeNetExpectedReturnRatePercent(
  profitRatePercent: number | null | undefined,
  serviceFeeRatePercent: number | null | undefined
): number | null {
  if (profitRatePercent == null) return null;
  const serviceFeeRate = serviceFeeRatePercent ?? 0;
  return profitRatePercent * (1 - serviceFeeRate / 100);
}

export function computeExpectedPayoutAmount(
  principal: number,
  netExpectedReturnRatePercent: number
): number {
  return principal + principal * (netExpectedReturnRatePercent / 100);
}

export function resolveNetExpectedReturnRatePercent(input: {
  profitRatePercent: number | null | undefined;
  serviceFeeRatePercent: number | null | undefined;
}): number | null {
  const rate = computeNetExpectedReturnRatePercent(
    input.profitRatePercent,
    input.serviceFeeRatePercent
  );
  if (rate == null) return null;
  return roundNoteMoney(rate, INVESTOR_RETURN_RATE_DISPLAY_DECIMALS);
}
