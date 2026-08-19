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

export function withdrawMinimumHint(minAmount: number): string {
  return `You can withdraw from ${formatCurrency(minAmount)}.`;
}

export function withdrawMinimumError(minAmount: number): string {
  return `The minimum you can withdraw is ${formatCurrency(minAmount)}.`;
}

export function formatBankAccountHint(accountNumber: string): string {
  const trimmed = accountNumber.trim();
  if (!trimmed) return "Not set";
  if (/^loading/i.test(trimmed) || /^not set$/i.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 4) return trimmed;
  return `ending ${digits.slice(-4)}`;
}
