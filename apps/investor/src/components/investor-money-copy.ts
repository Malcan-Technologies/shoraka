import { formatCurrency } from "@cashsouk/config";
import { INVESTMENT_LIMIT_TIER_LABELS, type InvestmentLimitTier } from "@cashsouk/types";

type DepositLimitHint = {
  tier: InvestmentLimitTier;
  limit: number | null;
  depositHeadroom?: number | null;
};

export const INVESTOR_TYPE_REQUIRED_DEPOSIT_MESSAGE =
  "Set your Type of Investor in your profile before you deposit. We use it to work out your investment limit.";

export function dashboardParticipationHint(
  investmentLimit?: {
    classificationRequired?: boolean;
    tier: InvestmentLimitTier;
    limit: number | null;
  } | null
): string {
  if (investmentLimit == null) return "Limit depends on investor type";
  if (investmentLimit.classificationRequired) return "Set your Type of Investor to see your limit";
  if (investmentLimit.limit == null) return "No cap on outstanding principal";
  const tierLabel = INVESTMENT_LIMIT_TIER_LABELS[investmentLimit.tier];
  return `${tierLabel} cap ${formatCurrency(investmentLimit.limit)} outstanding`;
}

export function depositLimitsHint(
  minAmount: number,
  maxAmount: number,
  investmentLimit?: DepositLimitHint | null
): string {
  const range = `You can add from ${formatCurrency(minAmount)} to ${formatCurrency(maxAmount)}.`;
  if (!investmentLimit || investmentLimit.limit == null) return range;
  const tierLabel = INVESTMENT_LIMIT_TIER_LABELS[investmentLimit.tier];
  const remaining =
    investmentLimit.depositHeadroom == null
      ? null
      : formatCurrency(investmentLimit.depositHeadroom);
  if (remaining) {
    return `${range} You can deposit up to ${remaining} more under your ${tierLabel} limit of ${formatCurrency(investmentLimit.limit)}.`;
  }
  return `${range} Remaining under your ${tierLabel} limit of ${formatCurrency(investmentLimit.limit)}.`;
}

export function depositHeadroomBlockedHint(
  remaining: number,
  minAmount: number,
  investmentLimit: { tier: InvestmentLimitTier; limit: number; pendingDeposits?: number }
): string {
  const tierLabel = INVESTMENT_LIMIT_TIER_LABELS[investmentLimit.tier];
  const pending = investmentLimit.pendingDeposits ?? 0;
  const pendingClause =
    pending > 0 ? `, including ${formatCurrency(pending)} still clearing` : "";
  return `You can deposit up to ${formatCurrency(remaining)} more under your ${tierLabel} limit of ${formatCurrency(investmentLimit.limit)}${pendingClause}. The minimum deposit is ${formatCurrency(minAmount)}.`;
}

export function depositMinimumError(minAmount: number): string {
  return `The minimum you can add is ${formatCurrency(minAmount)}.`;
}

export function depositMaximumError(maxAmount: number): string {
  return `The most you can add at once is ${formatCurrency(maxAmount)}.`;
}

function typedAmountLimitError(
  amount: number,
  minAmount: number,
  maxAmount: number,
  minError: (minAmount: number) => string,
  maxError: (maxAmount: number) => string
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount < minAmount) return minError(minAmount);
  if (amount > maxAmount) return maxError(maxAmount);
  return null;
}

/** Live field error once an amount is entered. Empty / zero stays on the hint until submit. */
export function depositTypedAmountError(
  amount: number,
  minAmount: number,
  maxAmount: number
): string | null {
  return typedAmountLimitError(
    amount,
    minAmount,
    maxAmount,
    depositMinimumError,
    depositMaximumError
  );
}

export function withdrawLimitsHint(minAmount: number, maxAmount: number): string {
  if (maxAmount < minAmount) {
    return `You need at least ${formatCurrency(minAmount)} available cash to withdraw.`;
  }
  return `You can withdraw from ${formatCurrency(minAmount)} to ${formatCurrency(maxAmount)}.`;
}

export function withdrawMinimumError(minAmount: number): string {
  return `The minimum you can withdraw is ${formatCurrency(minAmount)}.`;
}

export function withdrawMaximumError(maxAmount: number): string {
  return `The most you can withdraw is ${formatCurrency(maxAmount)}.`;
}

/** Live field error once an amount is entered. Empty / zero stays on the hint until submit. */
export function withdrawTypedAmountError(
  amount: number,
  minAmount: number,
  maxAmount: number
): string | null {
  return typedAmountLimitError(
    amount,
    minAmount,
    maxAmount,
    withdrawMinimumError,
    withdrawMaximumError
  );
}

export function formatBankAccountHint(accountNumber: string): string {
  const trimmed = accountNumber.trim();
  if (!trimmed) return "Not set";
  if (/^loading/i.test(trimmed) || /^not set$/i.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 4) return trimmed;
  return `ending ${digits.slice(-4)}`;
}
