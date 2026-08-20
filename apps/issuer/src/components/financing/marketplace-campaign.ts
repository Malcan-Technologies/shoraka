import {
  computeMarketplaceCommitBounds,
  marketplaceListingKind,
  meetsMinimumFunding,
  resolveMarketplaceListingDaysLeft,
  type MarketplaceListingKind,
} from "@cashsouk/types";

export type IssuerMarketplaceNoteInput = {
  status?: string | null;
  noteStatus?: string | null;
  listingStatus?: string | null;
  fundingStatus?: string | null;
  targetAmount?: string | number | null;
  fundedAmount?: string | number | null;
  fundingProgressPercent?: number | null;
  minimumFundingPercent?: string | number | null;
  fundingDeadline?: string | null;
  listingClosesAt?: string | null;
  investorCount?: number | null;
};

export type IssuerMarketplaceCampaign = {
  listingKind: MarketplaceListingKind;
  raising: boolean;
  fundingPercent: number;
  minimumPercent: number;
  remainingCapacity: number;
  daysLeft: number | null;
  closesAt: string | null;
  investorCount: number;
  fundedAmount: number;
  targetAmount: number;
  thresholdReached: boolean;
};

export function parseIssuerNoteMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function resolveIssuerMinimumFundingPercent(value: unknown): number {
  const parsed = parseIssuerNoteMoney(value);
  if (parsed <= 0) return 80;
  return Math.min(100, Math.round(parsed));
}

export function buildIssuerMarketplaceCampaign(
  note: IssuerMarketplaceNoteInput
): IssuerMarketplaceCampaign {
  const listingKind = marketplaceListingKind({
    status: String(note.noteStatus ?? note.status ?? ""),
    listingStatus: String(note.listingStatus ?? ""),
    fundingStatus: String(note.fundingStatus ?? ""),
  });
  const targetAmount = parseIssuerNoteMoney(note.targetAmount);
  const fundedAmount = parseIssuerNoteMoney(note.fundedAmount);
  const minimumPercent = resolveIssuerMinimumFundingPercent(note.minimumFundingPercent);
  const progress = note.fundingProgressPercent;
  const fundingPercent =
    progress != null && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, progress))
      : targetAmount > 0
        ? Math.min(100, (fundedAmount / targetAmount) * 100)
        : 0;
  const closesAt = note.fundingDeadline ?? note.listingClosesAt ?? null;
  const { remainingCapacity } = computeMarketplaceCommitBounds(targetAmount, fundedAmount);

  return {
    listingKind,
    raising: listingKind === "open",
    fundingPercent,
    minimumPercent,
    remainingCapacity,
    daysLeft: resolveMarketplaceListingDaysLeft(closesAt),
    closesAt,
    investorCount: note.investorCount ?? 0,
    fundedAmount,
    targetAmount,
    thresholdReached: meetsMinimumFunding(fundedAmount, targetAmount, minimumPercent),
  };
}

export function issuerCampaignDaysLeftLabel(
  daysLeft: number | null,
  raising: boolean
): string | null {
  if (!raising) return null;
  if (daysLeft === null) return "Open for funding";
  if (daysLeft <= 0) return "Closes today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

export function issuerCampaignCloseLabel(
  dateLabel: string,
  daysLabel: string | null
): string {
  if (!daysLabel) return dateLabel;
  if (!dateLabel || dateLabel === "—") return daysLabel;
  return `${dateLabel} · ${daysLabel}`;
}

export function issuerFundingProgressSummary(
  campaign: IssuerMarketplaceCampaign,
  remainingLabel: string
): string {
  const funded = `${Math.round(campaign.fundingPercent)}% funded`;
  if (campaign.listingKind === "failed") {
    return `${Math.round(campaign.fundingPercent)}% raised · Funding unsuccessful`;
  }
  if (campaign.listingKind === "funded") {
    return funded;
  }
  if (campaign.remainingCapacity <= 0) {
    return `${funded} · Fully allocated`;
  }
  return `${funded} · ${campaign.minimumPercent}% min · ${remainingLabel} still open`;
}

export function issuerFailedFundingHelp(minimumPercent: number): string {
  return `If this note does not reach ${minimumPercent}% of its target by the listing deadline, funding is unsuccessful and investor commitments are released. You will not receive a disbursement.`;
}
