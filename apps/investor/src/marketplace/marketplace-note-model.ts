import { formatCurrency } from "@cashsouk/config";
import {
  computeMarketplaceCommitBounds,
  formatNoteReferenceDisplay,
  marketplaceListingKind,
  resolveMarketplaceDaysToMaturity,
  resolveMarketplaceListingDaysLeft,
  type MarketplaceListingFilter,
  type MarketplaceListingKind,
  type NoteListItem,
} from "@cashsouk/types";

export type MarketplaceNote = {
  id: string;
  noteCode: string | null;
  issuerName: string | null;
  noteTitle: string | null;
  productName: string | null;
  industry: string | null;
  fundedAmount: number;
  goalAmount: number;
  remainingCapacity: number;
  fundingPercent: number;
  annualReturn: number | null;
  tenorDays: number | null;
  riskScore: string | null;
  daysLeft: number | null;
  minInvestment: number;
  maxInvestment: number;
  minimumFundingPercent: number;
  investable: boolean;
  isFeatured?: boolean;
  featuredRank?: number;
  investorCount: number;
  listingKind: MarketplaceListingKind;
};

export type MarketplaceNoteFilters = {
  search: string;
  industry: string;
  risk: string;
  profit: string;
  tenor: string;
  listing: MarketplaceListingFilter;
};

export const DEFAULT_MARKETPLACE_FILTERS: MarketplaceNoteFilters = {
  search: "",
  industry: "all",
  risk: "all",
  profit: "all",
  tenor: "all",
  listing: "open",
};

export function toMarketplaceNote(note: NoteListItem): MarketplaceNote {
  const { minCommit, maxCommit, investable, remainingCapacity } = computeMarketplaceCommitBounds(
    note.targetAmount,
    note.fundedAmount
  );
  const goalAmount = note.targetAmount;
  const fundedAmount = note.fundedAmount;
  const fundingPercent =
    goalAmount > 0 ? Math.min(100, Math.round((fundedAmount / goalAmount) * 100)) : 0;
  const listingKind = marketplaceListingKind({
    status: note.status,
    listingStatus: note.listingStatus,
    fundingStatus: note.fundingStatus,
  });

  return {
    id: note.id,
    noteCode: note.noteReference.trim() || null,
    issuerName: note.issuerName?.trim() || null,
    noteTitle: note.title?.trim() || null,
    productName: note.productName?.trim() || null,
    industry: note.issuerIndustry?.trim() || null,
    fundedAmount,
    goalAmount,
    remainingCapacity,
    fundingPercent,
    annualReturn: note.profitRatePercent,
    tenorDays: resolveMarketplaceDaysToMaturity(note.maturityDate),
    riskScore: note.riskRating,
    daysLeft: resolveMarketplaceListingDaysLeft(note.listingClosesAt),
    minInvestment: minCommit,
    maxInvestment: maxCommit,
    minimumFundingPercent: marketplaceMinimumThresholdPercent(note.minimumFundingPercent),
    investable: investable && listingKind === "open",
    isFeatured: note.featuredActive,
    featuredRank: note.featuredRank ?? undefined,
    investorCount: note.investorCount ?? 0,
    listingKind,
  };
}

export function sortFeaturedMarketplaceNotes(notes: MarketplaceNote[]): MarketplaceNote[] {
  return [...notes].sort((left, right) => {
    const leftRank = left.featuredRank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.featuredRank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return (left.noteCode ?? "").localeCompare(right.noteCode ?? "");
  });
}

export function marketplaceNoteMatchesFilters(
  note: MarketplaceNote,
  filters: MarketplaceNoteFilters
): boolean {
  const query = filters.search.trim().toLowerCase();
  const matchesSearch =
    query.length === 0 ||
    [note.noteTitle, note.productName, note.issuerName, note.industry, note.noteCode]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(query)) ||
    formatNoteReferenceDisplay(note.noteCode).toLowerCase().includes(query);

  const matchesIndustry = filters.industry === "all" || note.industry === filters.industry;
  const matchesRisk = filters.risk === "all" || note.riskScore === filters.risk;
  const matchesProfit =
    filters.profit === "all" ||
    (note.annualReturn !== null &&
      ((filters.profit === "low" && note.annualReturn < 14) ||
        (filters.profit === "mid" && note.annualReturn >= 14 && note.annualReturn <= 15) ||
        (filters.profit === "high" && note.annualReturn > 15)));
  const matchesTenor =
    filters.tenor === "all" ||
    (note.tenorDays !== null &&
      ((filters.tenor === "short" && note.tenorDays <= 30) ||
        (filters.tenor === "medium" && note.tenorDays > 30 && note.tenorDays <= 45) ||
        (filters.tenor === "long" && note.tenorDays > 45)));
  const matchesListing = filters.listing === "all" || note.listingKind === filters.listing;

  return (
    matchesSearch &&
    matchesIndustry &&
    matchesRisk &&
    matchesProfit &&
    matchesTenor &&
    matchesListing
  );
}

export function marketplaceListingUrgency(note: MarketplaceNote): string {
  if (note.listingKind === "failed") return "Did not meet minimum";
  if (note.listingKind === "funded") return "Funding closed";
  if (note.daysLeft === null) return "Open for funding";
  if (note.daysLeft <= 0) return "Listing closing";
  if (note.daysLeft === 1) return "1 day left to invest";
  return `${note.daysLeft} days left to invest`;
}

export function marketplaceFundingSummary(note: MarketplaceNote): string {
  if (note.goalAmount <= 0) return "Funding target not published";
  if (note.listingKind === "failed") {
    return `${note.fundingPercent}% raised · Funding unsuccessful`;
  }
  if (note.listingKind === "funded") {
    return `${note.fundingPercent}% funded`;
  }
  if (!note.investable || note.remainingCapacity <= 0) {
    return `${note.fundingPercent}% funded · Fully allocated`;
  }
  return `${note.fundingPercent}% funded · ${note.minimumFundingPercent}% min · ${formatCurrency(note.remainingCapacity)} still open`;
}

export function marketplaceMinimumThresholdPercent(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value == null || value <= 0) return 80;
  return Math.min(100, Math.round(value));
}

export function marketplaceInvestAnyAmountLabel(note: MarketplaceNote): string {
  return `Invest any amount from ${formatCurrency(note.minInvestment)} to ${formatCurrency(note.maxInvestment)}`;
}

export function marketplaceFailedFundingHelp(minimumPercent: number): string {
  return `If this note does not reach ${minimumPercent}% of its target by the listing deadline, funding is unsuccessful and your commitment is released back to your available cash. You are not charged.`;
}

export function marketplaceInvestorSummary(note: MarketplaceNote): string {
  const amount = formatCurrency(note.fundedAmount);
  if (note.investorCount <= 0) return `${amount} committed`;
  if (note.investorCount === 1) return `${amount} committed by 1 investor`;
  return `${amount} committed by ${note.investorCount} investors`;
}

export function marketplaceInvestActionLabel(note: MarketplaceNote): string {
  if (note.investable) return "Invest";
  if (note.listingKind === "failed") return "Not funded";
  if (note.listingKind === "funded") return "Closed";
  return "Fully allocated";
}

/** Fill + track for the listing bar. Closed outcomes use the status scale. */
export function marketplaceFundingBarClasses(note: MarketplaceNote): {
  fill: string;
  track: string;
} {
  if (note.listingKind === "failed") {
    return { fill: "bg-status-rejected-text", track: "bg-status-rejected-bg" };
  }
  if (note.listingKind === "funded") {
    return { fill: "bg-status-success-text", track: "bg-status-success-bg" };
  }
  return { fill: "bg-primary", track: "bg-muted" };
}

export function marketplaceIssuerLabel(note: MarketplaceNote): string {
  return note.issuerName?.trim() || "Issuer not published";
}

export function marketplaceNoteLabel(note: MarketplaceNote): string {
  return formatNoteReferenceDisplay(note.noteCode);
}

export function marketplaceHasActiveFilters(filters: MarketplaceNoteFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.industry !== "all" ||
    filters.risk !== "all" ||
    filters.profit !== "all" ||
    filters.tenor !== "all" ||
    filters.listing !== "open"
  );
}
