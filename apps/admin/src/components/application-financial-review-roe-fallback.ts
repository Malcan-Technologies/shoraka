import { computeNetWorth, computeTotalAssets, computeTotalLiabilities } from "@cashsouk/types";

export type RoeNetWorthComponents = {
  fixedAssets: number | null;
  otherAssets: number | null;
  currentAssets: number | null;
  nonCurrentAssets: number | null;
  currentLiabilities: number | null;
  longTermLiabilities: number | null;
  nonCurrentLiabilities: number | null;
};

export function resolveNetWorthFromComponentsForRoe(
  components: RoeNetWorthComponents
): number | null {
  const totass = computeTotalAssets({
    total_assets: null,
    fixed_assets: components.fixedAssets,
    other_assets: components.otherAssets,
    current_assets: components.currentAssets,
    non_current_assets: components.nonCurrentAssets,
  });
  const totlib = computeTotalLiabilities({
    total_liabilities: null,
    current_liabilities: components.currentLiabilities,
    long_term_liabilities: components.longTermLiabilities,
    non_current_liabilities: components.nonCurrentLiabilities,
  });
  if (totass == null || totlib == null) return null;
  return computeNetWorth(totass, totlib);
}

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

