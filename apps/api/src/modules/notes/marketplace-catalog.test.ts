import {
  countNoteInvestors,
  formatNoteInvestorCount,
  isMarketplaceCatalogNote,
  marketplaceListingKind,
} from "@cashsouk/types";

describe("marketplaceListingKind", () => {
  it("classifies open, funded, and failed listings", () => {
    expect(
      marketplaceListingKind({
        status: "PUBLISHED",
        listingStatus: "PUBLISHED",
        fundingStatus: "OPEN",
      })
    ).toBe("open");
    expect(
      marketplaceListingKind({
        status: "FUNDING",
        listingStatus: "CLOSED",
        fundingStatus: "FUNDED",
      })
    ).toBe("funded");
    expect(
      marketplaceListingKind({
        status: "FAILED_FUNDING",
        listingStatus: "CLOSED",
        fundingStatus: "FAILED",
      })
    ).toBe("failed");
  });
});

describe("isMarketplaceCatalogNote", () => {
  it("accepts notes that were listed for funding", () => {
    expect(
      isMarketplaceCatalogNote({
        status: "ACTIVE",
        listingStatus: "CLOSED",
        fundingStatus: "FUNDED",
      })
    ).toBe(true);
  });

  it("rejects drafts that never listed", () => {
    expect(
      isMarketplaceCatalogNote({
        status: "DRAFT",
        listingStatus: "NOT_LISTED",
        fundingStatus: "NOT_OPEN",
      })
    ).toBe(false);
  });
});

describe("countNoteInvestors", () => {
  it("counts unique investor organizations and ignores cancelled rows", () => {
    expect(
      countNoteInvestors([
        { investorOrganizationId: "org_a", status: "COMMITTED" },
        { investorOrganizationId: "org_a", status: "CONFIRMED" },
        { investorOrganizationId: "org_b", status: "RELEASED" },
        { investorOrganizationId: "org_c", status: "CANCELLED" },
      ])
    ).toBe(2);
  });
});

describe("formatNoteInvestorCount", () => {
  it("formats empty, singular, and plural counts", () => {
    expect(formatNoteInvestorCount(0)).toBe("None yet");
    expect(formatNoteInvestorCount(1)).toBe("1 investor");
    expect(formatNoteInvestorCount(4)).toBe("4 investors");
  });
});
