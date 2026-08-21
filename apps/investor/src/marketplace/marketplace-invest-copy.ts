import { formatCurrency } from "@cashsouk/config";
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
