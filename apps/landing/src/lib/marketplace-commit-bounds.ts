export const MARKETPLACE_MIN_COMMIT_MYR = 100;

export type MarketplaceCommitBounds = {
  remainingCapacity: number;
  minCommit: number;
  maxCommit: number;
  investable: boolean;
};

export function computeMarketplaceCommitBounds(
  targetAmount: number,
  fundedAmount: number
): MarketplaceCommitBounds {
  const remainingCapacity = Math.max(0, Number(targetAmount) - Number(fundedAmount));

  if (!Number.isFinite(remainingCapacity) || remainingCapacity <= 0) {
    return {
      remainingCapacity: 0,
      minCommit: 0,
      maxCommit: 0,
      investable: false,
    };
  }

  const minCommit = Math.min(MARKETPLACE_MIN_COMMIT_MYR, remainingCapacity);
  const maxCommit = remainingCapacity;
  const investable = minCommit <= maxCommit && minCommit > 0;

  return {
    remainingCapacity,
    minCommit,
    maxCommit,
    investable,
  };
}
