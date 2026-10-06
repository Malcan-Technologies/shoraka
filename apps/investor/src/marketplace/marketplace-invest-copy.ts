import { formatCurrency } from "@cashsouk/config";
import {
  formatInvestorReturnRatePercent,
  INVESTMENT_LIMIT_TIER_LABELS,
  type InvestorInvestmentLimit,
} from "@cashsouk/types";
import {
  marketplaceInvestAnyAmountLabel,
  marketplaceNoteLabel,
  type MarketplaceNote,
} from "./marketplace-note-model";

export function marketplaceInvestLead(): string {
  return "Choose how much you'd like to invest in this note.";
}

export function marketplaceInvestMeta(note: MarketplaceNote | null): string {
  if (!note) return "";
  const parts = [marketplaceNoteLabel(note)];
  const product = note.productName?.trim();
  if (product) parts.push(product);
  return parts.join(" · ");
}

export function marketplaceConfirmLead(amountLabel: string): string {
  return `You're about to commit ${amountLabel} to this note.`;
}

export function marketplaceInvestRangeHint(note: MarketplaceNote | null): string | null {
  if (!note) return null;
  return `${marketplaceInvestAnyAmountLabel(note)}.`;
}

export function marketplaceAvailableCashHint(availableBalance: number): string {
  return `Available cash ${formatCurrency(availableBalance)}`;
}

export function marketplaceInvestLimitHint(
  investmentLimit: InvestorInvestmentLimit | null | undefined
): string | null {
  if (!investmentLimit || investmentLimit.limit == null || investmentLimit.investHeadroom == null) {
    return null;
  }
  if (investmentLimit.classificationRequired) {
    return "Set your Type of Investor in your profile before you invest.";
  }
  const tierLabel = INVESTMENT_LIMIT_TIER_LABELS[investmentLimit.tier];
  return `You can invest up to ${formatCurrency(investmentLimit.investHeadroom)} more under your ${tierLabel} limit of ${formatCurrency(investmentLimit.limit)}.`;
}

export function marketplaceConfirmReturnHint(note: MarketplaceNote | null): string | null {
  if (!note) return null;
  const rate = formatInvestorReturnRatePercent(note.annualReturn);
  if (note.timing.isTenureNote) {
    return `${note.timing.value}. Advertised return is up to ${rate} p.a. before the service fee, for the days profit actually runs.`;
  }
  return `Advertised return is ${rate} p.a. before the service fee.`;
}
