import { NoteInvestmentStatus } from "./notes";

export type MarketplaceListingKind = "open" | "funded" | "failed";
export type MarketplaceListingFilter = "open" | "funded" | "failed" | "all";

export function marketplaceListingKind(input: {
  status: string;
  listingStatus: string;
  fundingStatus: string;
}): MarketplaceListingKind {
  if (input.status === "FAILED_FUNDING" || input.fundingStatus === "FAILED") {
    return "failed";
  }
  if (input.fundingStatus === "OPEN" && input.listingStatus === "PUBLISHED") {
    return "open";
  }
  return "funded";
}

export function isMarketplaceCatalogNote(input: {
  status: string;
  listingStatus: string;
  fundingStatus: string;
}): boolean {
  if (input.listingStatus === "PUBLISHED" && input.fundingStatus === "OPEN") {
    return true;
  }
  return (
    input.listingStatus === "CLOSED" &&
    (input.fundingStatus === "FUNDED" || input.fundingStatus === "FAILED")
  );
}

export function countNoteInvestors(
  investments: ReadonlyArray<{ investorOrganizationId: string; status: string }>
): number {
  const ids = new Set<string>();
  for (const investment of investments) {
    if (investment.status === NoteInvestmentStatus.CANCELLED) continue;
    const id = investment.investorOrganizationId.trim();
    if (!id) continue;
    ids.add(id);
  }
  return ids.size;
}

export function formatNoteInvestorCount(count: number): string {
  if (count <= 0) return "None yet";
  if (count === 1) return "1 investor";
  return `${count} investors`;
}
