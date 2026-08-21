import { formatCurrency } from "@cashsouk/config";
import {
  marketplaceInvestAnyAmountLabel,
  marketplaceIssuerLabel,
  marketplaceNoteLabel,
  type MarketplaceNote,
} from "./marketplace-note-model";

function publishedIssuerName(note: MarketplaceNote | null): string | null {
  if (!note) return null;
  const issuer = marketplaceIssuerLabel(note);
  return issuer === "Issuer not published" ? null : issuer;
}

export function marketplaceInvestLead(note: MarketplaceNote | null): string {
  const issuer = publishedIssuerName(note);
  if (issuer) return `You're putting cash into ${issuer}.`;
  return "Choose how much you'd like to invest in this note.";
}

export function marketplaceInvestMeta(note: MarketplaceNote | null): string {
  if (!note) return "";
  const parts = [marketplaceNoteLabel(note)];
  const product = note.productName?.trim();
  if (product) parts.push(product);
  return parts.join(" · ");
}

export function marketplaceConfirmLead(amountLabel: string, note: MarketplaceNote | null): string {
  const issuer = publishedIssuerName(note);
  if (issuer) return `You're about to commit ${amountLabel} to ${issuer}.`;
  return `You're about to commit ${amountLabel} to this note.`;
}

export function marketplaceInvestRangeHint(note: MarketplaceNote | null): string | null {
  if (!note) return null;
  return `${marketplaceInvestAnyAmountLabel(note)}.`;
}

export function marketplaceAvailableCashHint(availableBalance: number): string {
  return `Available cash ${formatCurrency(availableBalance)}`;
}
