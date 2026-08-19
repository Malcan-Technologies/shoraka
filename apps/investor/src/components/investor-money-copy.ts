import { formatCurrency } from "@cashsouk/config";

export function depositLimitsHint(minAmount: number, maxAmount: number): string {
  return `You can add from ${formatCurrency(minAmount)} to ${formatCurrency(maxAmount)}.`;
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
