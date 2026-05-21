import { roundNoteMoney } from "./note-expected-return";

/** Half-cent tolerance used across note money comparisons (MYR). */
export const NOTE_MONEY_TOLERANCE = 0.005;

/** Standard investor-facing money precision (MYR). */
export const NOTE_MONEY_DECIMALS = 2;

/** Platform floor for a single marketplace commit ticket. */
export const MARKETPLACE_MIN_COMMIT_MYR = 100;

const NOTE_MONEY_PRECISION_EPSILON = 1e-9;

/** True when `value` has at most `decimals` fractional digits (reject 100.999 etc.). */
export function isNoteMoneyAmount(value: number, decimals = NOTE_MONEY_DECIMALS): boolean {
  if (!Number.isFinite(value)) return false;
  return Math.abs(value - roundNoteMoney(value, decimals)) < NOTE_MONEY_PRECISION_EPSILON;
}

export type MarketplaceCommitBounds = {
  remainingCapacity: number;
  minCommit: number;
  maxCommit: number;
  investable: boolean;
};

/**
 * Derive min/max commit for one investor action from note capacity.
 * Remaining capacity is rounded to 2dp so UI and API agree on ticket bounds.
 */
export function computeMarketplaceCommitBounds(
  targetAmount: number,
  fundedAmount: number
): MarketplaceCommitBounds {
  const remainingCapacity = roundNoteMoney(
    Math.max(0, Number(targetAmount) - Number(fundedAmount)),
    NOTE_MONEY_DECIMALS
  );
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

/** Whether funded amount meets the minimum funding threshold (with half-cent tolerance). */
export function meetsMinimumFunding(
  fundedAmount: number,
  targetAmount: number,
  minimumFundingPercent = 80
): boolean {
  if (targetAmount <= 0) return false;
  const fundingPercent = (fundedAmount / targetAmount) * 100;
  return fundingPercent + NOTE_MONEY_TOLERANCE >= minimumFundingPercent;
}

/** Whether a note has reached its funding target (with half-cent tolerance). */
export function isNoteFullyFunded(fundedAmount: number, targetAmount: number): boolean {
  if (targetAmount <= 0) return false;
  return fundedAmount + NOTE_MONEY_TOLERANCE >= targetAmount;
}

/**
 * Reconciled investor portfolio totals: headline equals sum of visible parts.
 * `portfolioTotal = round(roundedAvailable + roundedCommitted)`.
 */
export function buildInvestorPortfolioTotals(availableBalance: number, committed: number) {
  const roundedAvailable = roundNoteMoney(availableBalance, NOTE_MONEY_DECIMALS);
  const roundedCommitted = roundNoteMoney(committed, NOTE_MONEY_DECIMALS);
  return {
    availableBalance: roundedAvailable,
    totalInvestment: roundedCommitted,
    portfolioTotal: roundNoteMoney(
      roundedAvailable + roundedCommitted,
      NOTE_MONEY_DECIMALS
    ),
  };
}

/**
 * Split `totalAmount` across `weights` at `decimals` precision using largest-remainder
 * so line items sum exactly to the rounded total.
 */
export function allocateProRataNoteMoney(
  totalAmount: number,
  weights: number[],
  decimals = NOTE_MONEY_DECIMALS
): number[] {
  if (weights.length === 0) return [];
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalAmount <= 0 || totalWeight <= 0) {
    return weights.map(() => 0);
  }

  const factor = 10 ** decimals;
  const totalUnits = Math.round(roundNoteMoney(totalAmount, decimals) * factor);
  const rawUnits = weights.map((weight) => (weight / totalWeight) * totalUnits);
  const floorUnits = rawUnits.map((units) => Math.floor(units));
  let remainder = totalUnits - floorUnits.reduce((sum, units) => sum + units, 0);

  const rankedIndices = weights
    .map((_, index) => index)
    .sort((left, right) => {
      const leftFraction = rawUnits[left] - floorUnits[left];
      const rightFraction = rawUnits[right] - floorUnits[right];
      if (rightFraction !== leftFraction) return rightFraction - leftFraction;
      return left - right;
    });

  const allocatedUnits = [...floorUnits];
  for (const index of rankedIndices) {
    if (remainder <= 0) break;
    allocatedUnits[index] += 1;
    remainder -= 1;
  }

  return allocatedUnits.map((units) => units / factor);
}

export type SettlementInvestorAllocationInput = {
  investmentId: string;
  investorOrganizationId: string;
  amount: number;
};

export type SettlementInvestorAllocation = SettlementInvestorAllocationInput & {
  principal: number;
  profitNet: number;
};

/** Cent-safe pro-rata principal and profit lines for settlement preview/post. */
export function buildSettlementInvestorAllocations(input: {
  investments: SettlementInvestorAllocationInput[];
  investorPrincipal: number;
  investorProfitNet: number;
}): SettlementInvestorAllocation[] {
  const { investments, investorPrincipal, investorProfitNet } = input;
  if (investments.length === 0) return [];

  const weights = investments.map((investment) => investment.amount);
  const principalShares = allocateProRataNoteMoney(investorPrincipal, weights);
  const profitShares = allocateProRataNoteMoney(investorProfitNet, weights);

  return investments.map((investment, index) => ({
    investmentId: investment.investmentId,
    investorOrganizationId: investment.investorOrganizationId,
    amount: investment.amount,
    principal: principalShares[index] ?? 0,
    profitNet: profitShares[index] ?? 0,
  }));
}
