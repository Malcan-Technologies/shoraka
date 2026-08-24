import {
  NoteFundingStatus,
  NoteListingStatus,
  NoteStatus,
  type NoteListItem,
} from "@cashsouk/types";
import {
  marketplaceFailedFundingHelp,
  marketplaceFundingBarClasses,
  marketplaceFundingSummary,
  marketplaceHasActiveFilters,
  marketplaceInvestAnyAmountLabel,
  marketplaceInvestorSummary,
  marketplaceContractPurposeLabel,
  marketplaceListingUrgency,
  marketplaceNoteHeadline,
  marketplaceNoteContextLine,
  marketplaceMinimumThresholdPercent,
  marketplaceNoteMatchesFilters,
  sortFeaturedMarketplaceNotes,
  toMarketplaceNote,
  type MarketplaceNote,
} from "./marketplace-note-model";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
}));

function note(overrides: Partial<NoteListItem> = {}): NoteListItem {
  return {
    id: "note_1",
    noteReference: "NOTE-20260819-ABC",
    title: "Invoice note",
    productCategory: null,
    productName: "Invoice financing",
    issuerIndustry: "Manufacturing",
    sourceApplicationId: "app_1",
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: "inv_1",
    issuerOrganizationId: "org_1",
    purposeOfFinancing: "Working capital for a new contract",
    contractTitle: "Mining Rig Repair 12654",
    purposeOfContract: "Repair and maintenance for 12 mining rigs",
    issuerName: "Acme Sdn Bhd",
    paymasterName: "Paymaster Co",
    riskRating: "B",
    status: "FUNDING" as NoteListItem["status"],
    listingStatus: "PUBLISHED" as NoteListItem["listingStatus"],
    fundingStatus: "OPEN" as NoteListItem["fundingStatus"],
    servicingStatus: "NOT_STARTED" as NoteListItem["servicingStatus"],
    investorCount: 3,
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    maturityDate: null,
    listingClosesAt: null,
    activatedAt: null,
    publishedAt: "2026-08-01",
    fundingClosedAt: null,
    repaidAt: null,
    settlementSummary: null,
    createdAt: "2026-07-15",
    updatedAt: "2026-08-10",
    requestedAmount: 100000,
    invoiceAmount: 120000,
    settlementAmount: 100000,
    targetAmount: 100000,
    fundedAmount: 32000,
    fundingPercent: 32,
    minimumFundingPercent: 80,
    profitRatePercent: 14.5,
    platformFeeRatePercent: 1,
    serviceFeeRatePercent: 0,
    ...overrides,
  };
}

function listing(overrides: Partial<MarketplaceNote> = {}): MarketplaceNote {
  return { ...toMarketplaceNote(note()), ...overrides };
}

describe("toMarketplaceNote", () => {
  it("exposes purpose, remaining capacity, and investable bounds", () => {
    const mapped = toMarketplaceNote(note());
    expect(mapped.purposeOfFinancing).toBe("Working capital for a new contract");
    expect(mapped.contractTitle).toBe("Mining Rig Repair 12654");
    expect(mapped.purposeOfContract).toBe("Repair and maintenance for 12 mining rigs");
    expect(mapped.industry).toBe("Manufacturing");
    expect(mapped.fundingPercent).toBe(32);
    expect(mapped.remainingCapacity).toBe(68000);
    expect(mapped.investable).toBe(true);
    expect(mapped.minInvestment).toBe(100);
    expect(mapped.maxInvestment).toBe(68000);
    expect(mapped.minimumFundingPercent).toBe(80);
  });

  it("defaults a missing minimum threshold to 80%", () => {
    expect(marketplaceMinimumThresholdPercent(undefined)).toBe(80);
    expect(marketplaceMinimumThresholdPercent(0)).toBe(80);
    expect(toMarketplaceNote(note({ minimumFundingPercent: 60 })).minimumFundingPercent).toBe(60);
  });

  it("marks a fully allocated note as not investable", () => {
    const mapped = toMarketplaceNote(note({ fundedAmount: 100000, fundingPercent: 100 }));
    expect(mapped.investable).toBe(false);
    expect(mapped.remainingCapacity).toBe(0);
  });

  it("does not treat closed notes as investable even when capacity remains", () => {
    const failed = toMarketplaceNote(
      note({
        status: NoteStatus.FAILED_FUNDING,
        listingStatus: NoteListingStatus.CLOSED,
        fundingStatus: NoteFundingStatus.FAILED,
        fundedAmount: 0,
        fundingPercent: 0,
      })
    );
    const funded = toMarketplaceNote(
      note({
        status: NoteStatus.ACTIVE,
        listingStatus: NoteListingStatus.CLOSED,
        fundingStatus: NoteFundingStatus.FUNDED,
        fundedAmount: 94000,
        fundingPercent: 94,
      })
    );
    expect(failed.listingKind).toBe("failed");
    expect(failed.investable).toBe(false);
    expect(funded.listingKind).toBe("funded");
    expect(funded.investable).toBe(false);
  });
});

describe("sortFeaturedMarketplaceNotes", () => {
  it("orders by featured rank then note code", () => {
    const sorted = sortFeaturedMarketplaceNotes([
      listing({ id: "c", noteCode: "NOTE-C", featuredRank: 3 }),
      listing({ id: "a", noteCode: "NOTE-A", featuredRank: 1 }),
      listing({ id: "b", noteCode: "NOTE-B", featuredRank: 1 }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});

describe("marketplaceNoteMatchesFilters", () => {
  const acme = listing();

  it("matches search against purpose, industry, and note reference", () => {
    expect(
      marketplaceNoteMatchesFilters(acme, {
        search: "working capital",
        industry: "all",
        risk: "all",
        profit: "all",
        tenor: "all",
        listing: "open",
      })
    ).toBe(true);
    expect(
      marketplaceNoteMatchesFilters(acme, {
        search: "mining rig",
        industry: "all",
        risk: "all",
        profit: "all",
        tenor: "all",
        listing: "open",
      })
    ).toBe(true);
    expect(
      marketplaceNoteMatchesFilters(acme, {
        search: "acme",
        industry: "all",
        risk: "all",
        profit: "all",
        tenor: "all",
        listing: "open",
      })
    ).toBe(false);
    expect(
      marketplaceNoteMatchesFilters(acme, {
        search: "manufacturing",
        industry: "all",
        risk: "all",
        profit: "all",
        tenor: "all",
        listing: "open",
      })
    ).toBe(true);
    expect(
      marketplaceNoteMatchesFilters(acme, {
        search: "20260819",
        industry: "all",
        risk: "all",
        profit: "all",
        tenor: "all",
        listing: "open",
      })
    ).toBe(true);
    expect(
      marketplaceNoteMatchesFilters(acme, {
        search: "healthcare",
        industry: "all",
        risk: "all",
        profit: "all",
        tenor: "all",
        listing: "open",
      })
    ).toBe(false);
  });

  it("applies industry, risk, and profit bands", () => {
    expect(
      marketplaceNoteMatchesFilters(acme, {
        search: "",
        industry: "Healthcare",
        risk: "all",
        profit: "all",
        tenor: "all",
        listing: "open",
      })
    ).toBe(false);
    expect(
      marketplaceNoteMatchesFilters(acme, {
        search: "",
        industry: "all",
        risk: "A",
        profit: "all",
        tenor: "all",
        listing: "open",
      })
    ).toBe(false);
    expect(
      marketplaceNoteMatchesFilters(acme, {
        search: "",
        industry: "Manufacturing",
        risk: "B",
        profit: "mid",
        tenor: "all",
        listing: "open",
      })
    ).toBe(true);
  });

  it("hides closed notes unless the listing filter asks for them", () => {
    const funded = listing({ listingKind: "funded", investable: false });
    const failed = listing({ listingKind: "failed", investable: false });
    const openFilters = {
      search: "",
      industry: "all",
      risk: "all",
      profit: "all",
      tenor: "all",
      listing: "open" as const,
    };
    expect(marketplaceNoteMatchesFilters(funded, openFilters)).toBe(false);
    expect(marketplaceNoteMatchesFilters(failed, openFilters)).toBe(false);
    expect(marketplaceNoteMatchesFilters(funded, { ...openFilters, listing: "funded" })).toBe(true);
    expect(marketplaceNoteMatchesFilters(failed, { ...openFilters, listing: "failed" })).toBe(true);
    expect(marketplaceNoteMatchesFilters(funded, { ...openFilters, listing: "all" })).toBe(true);
  });
});

describe("marketplace copy helpers", () => {
  it("describes listing urgency and remaining capacity", () => {
    expect(marketplaceListingUrgency(listing({ daysLeft: null }))).toBe("Open for funding");
    expect(marketplaceListingUrgency(listing({ daysLeft: 1 }))).toBe("1 day left to invest");
    expect(marketplaceListingUrgency(listing({ daysLeft: 12 }))).toBe("12 days left to invest");
    expect(marketplaceListingUrgency(listing({ listingKind: "funded" }))).toBe("Funding closed");
    expect(marketplaceListingUrgency(listing({ listingKind: "failed" }))).toBe("Did not meet minimum");
    expect(marketplaceFundingSummary(listing())).toBe("32% funded · 80% min · RM 68000 still open");
    expect(marketplaceInvestAnyAmountLabel(listing())).toBe(
      "Invest any amount from RM 100 to RM 68000"
    );
    expect(marketplaceFailedFundingHelp(80)).toBe(
      "If this note does not reach 80% of its target by the listing deadline, funding is unsuccessful and your commitment is released back to your available cash. You are not charged."
    );
    expect(
      marketplaceFundingSummary(listing({ investable: false, remainingCapacity: 0, fundingPercent: 100 }))
    ).toBe("100% funded · Fully allocated");
    expect(
      marketplaceFundingSummary(listing({ listingKind: "failed", fundingPercent: 40 }))
    ).toBe("40% raised · Funding unsuccessful");
    expect(marketplaceNoteHeadline(listing({ purposeOfFinancing: null }))).toBe(
      "Note 20260819-ABC"
    );
    expect(marketplaceNoteHeadline(listing())).toBe("Working capital for a new contract");
    expect(marketplaceContractPurposeLabel(listing())).toBe(
      "Mining Rig Repair 12654 · Repair and maintenance for 12 mining rigs"
    );
    expect(
      marketplaceContractPurposeLabel(
        listing({ contractTitle: null, purposeOfContract: "Repair and maintenance" })
      )
    ).toBe("Repair and maintenance");
    expect(
      marketplaceContractPurposeLabel(listing({ contractTitle: null, purposeOfContract: null }))
    ).toBeNull();
    expect(marketplaceNoteContextLine(listing())).toBe(
      "Note 20260819-ABC · Invoice financing · Manufacturing"
    );
    expect(marketplaceNoteContextLine(listing({ productName: null, industry: null }))).toBe(
      "Note 20260819-ABC"
    );
    expect(marketplaceInvestorSummary(listing({ fundedAmount: 32000, investorCount: 3 }))).toBe(
      "RM 32000 committed by 3 investors"
    );
  });

  it("paints closed funding bars with status tokens", () => {
    expect(marketplaceFundingBarClasses(listing())).toEqual({
      fill: "bg-primary",
      track: "bg-muted",
    });
    expect(marketplaceFundingBarClasses(listing({ listingKind: "funded" }))).toEqual({
      fill: "bg-status-success-text",
      track: "bg-status-success-bg",
    });
    expect(marketplaceFundingBarClasses(listing({ listingKind: "failed" }))).toEqual({
      fill: "bg-status-rejected-text",
      track: "bg-status-rejected-bg",
    });
  });

  it("detects active filters", () => {
    expect(
      marketplaceHasActiveFilters({
        search: "",
        industry: "all",
        risk: "all",
        profit: "all",
        tenor: "all",
        listing: "open",
      })
    ).toBe(false);
    expect(
      marketplaceHasActiveFilters({
        search: "",
        industry: "all",
        risk: "all",
        profit: "all",
        tenor: "all",
        listing: "all",
      })
    ).toBe(true);
  });
});
