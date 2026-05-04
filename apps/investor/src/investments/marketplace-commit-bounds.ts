/**
 * Platform floor for a single marketplace commit. When remaining capacity is
 * smaller, the effective minimum is the full remainder.
 */
export const MARKETPLACE_MIN_COMMIT_MYR = 100;

export type MarketplaceCommitBounds = {
  remainingCapacity: number;
  minCommit: number;
  maxCommit: number;
  /** False when nothing is left to fund or amounts are inconsistent. */
  investable: boolean;
};

/**
 * Derive min/max commit for one investor action from note capacity.
 * - maxCommit is always the true remaining capacity (never inflated by the platform floor).
 * - minCommit is min(floor, remaining) so notes smaller than the floor still fund in one ticket.
 *
 * Align rules with `MARKETPLACE_MIN_COMMIT_MYR` in `apps/api/src/modules/notes/service.ts` (`createInvestment`).
 */
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
