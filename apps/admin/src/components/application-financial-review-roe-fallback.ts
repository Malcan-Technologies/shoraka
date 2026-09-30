export function getReturnOfEquityMissingReason({
  pat,
  netWorth,
}: {
  pat: number | null;
  netWorth: number | null;
}): string {
  if (pat == null) return "Missing: Profit / Loss After Tax";
  if (netWorth == null) return "Missing: Total Equity / Net Worth";
  if (netWorth === 0) return "Invalid: Total Equity / Net Worth is zero";
  return "Missing required financial inputs";
}
