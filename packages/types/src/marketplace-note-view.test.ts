import {
  assignFeaturedMarketplaceTags,
  deriveFeaturedMarketplaceTag,
  formatCompactMarketplaceAmount,
  formatCompactMarketplaceAmountPair,
  marketplaceBookSummary,
  marketplaceCardDaysLeftLabel,
  marketplaceCardRateLabel,
  marketplaceCardTenureLabel,
  marketplaceInvestorSummary,
  marketplaceSectorOptions,
  parseMarketplaceSort,
  parseMarketplaceViewMode,
  sortMarketplaceNotes,
  type MarketplaceNote,
} from "./marketplace-note-view";
import type { NoteTimingDisplay } from "./note-timing-display";

const TIMING: NoteTimingDisplay = {
  kind: "tenure_pending",
  isTenureNote: true,
  label: "Financing tenure",
  value: "90 days from disbursement",
  compactValue: "90d",
  compactLabel: "Tenure",
  compactExtra: null,
  secondary: null,
  tooltip: null,
  filterDays: 90,
  sortTime: null,
  tenureDays: 90,
};

function note(overrides: Partial<MarketplaceNote> = {}): MarketplaceNote {
  return {
    id: "note_1",
    noteCode: "NOTE-1",
    purposeOfFinancing: "Working capital",
    contractTitle: null,
    purposeOfContract: null,
    noteTitle: "Working capital",
    productName: "Invoice financing",
    productImageS3Key: null,
    productImageUrl: null,
    industry: "Manufacturing",
    fundedAmount: 0,
    goalAmount: 100000,
    remainingCapacity: 100000,
    fundingPercent: 0,
    annualReturn: 8,
    tenorDays: 90,
    timing: TIMING,
    riskScore: "SME-3",
    daysLeft: 10,
    minInvestment: 1000,
    maxInvestment: 100000,
    minimumFundingPercent: 80,
    investable: true,
    isFeatured: true,
    featuredRank: 1,
    investorCount: 0,
    listingKind: "open",
    publishedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("marketplace sort and view parsers", () => {
  it("parses known sort and view values and falls back to defaults", () => {
    expect(parseMarketplaceSort("tenor")).toBe("tenor");
    expect(parseMarketplaceSort("unknown")).toBe("rate");
    expect(parseMarketplaceSort(undefined)).toBe("rate");
    expect(parseMarketplaceViewMode("cards")).toBe("cards");
    expect(parseMarketplaceViewMode("grid")).toBe("table");
  });
});

describe("sortMarketplaceNotes", () => {
  const notes = [
    note({ id: "a", annualReturn: 7.2, tenorDays: 180, riskScore: "SME-4", daysLeft: 9 }),
    note({ id: "b", annualReturn: 9.1, tenorDays: 30, riskScore: "SME-10", daysLeft: 2 }),
    note({ id: "c", annualReturn: 8.4, tenorDays: null, riskScore: "SME-1", daysLeft: null }),
  ];

  it("sorts by highest rate, then shortest tenure, best MARC grade, and closing soon", () => {
    expect(sortMarketplaceNotes(notes, "rate").map((item) => item.id)).toEqual(["b", "c", "a"]);
    expect(sortMarketplaceNotes(notes, "tenor").map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(sortMarketplaceNotes(notes, "grade").map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(sortMarketplaceNotes(notes, "closing").map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts notes without stored tenure last, not by listing countdown", () => {
    expect(
      sortMarketplaceNotes(
        [
          note({ id: "legacy", tenorDays: null, daysLeft: 1 }),
          note({ id: "term", tenorDays: 90, daysLeft: 20 }),
        ],
        "tenor"
      ).map((item) => item.id)
    ).toEqual(["term", "legacy"]);
  });
});

describe("marketplaceBookSummary", () => {
  it("summarises open notes and uses dashes when rates or tenures are missing", () => {
    expect(
      marketplaceBookSummary([
        note({ listingKind: "open", annualReturn: 7.2, tenorDays: 30 }),
        note({ listingKind: "open", annualReturn: 9.6, tenorDays: 180 }),
        note({ listingKind: "funded", annualReturn: 12, tenorDays: 12 }),
      ])
    ).toEqual({ openCount: 2, rateRange: "7.2–9.6%", tenureRange: "30–180d" });

    expect(
      marketplaceBookSummary([
        note({ listingKind: "open", annualReturn: null, tenorDays: null }),
        note({ listingKind: "funded", annualReturn: 8, tenorDays: 30 }),
      ])
    ).toEqual({ openCount: 1, rateRange: "—", tenureRange: "—" });

    expect(
      marketplaceBookSummary([
        note({ listingKind: "open", annualReturn: 8, tenorDays: null }),
        note({ listingKind: "open", annualReturn: 8, tenorDays: 90 }),
      ]).tenureRange
    ).toBe("90–90d");
  });
});

describe("featured marketplace tags", () => {
  const now = new Date("2026-09-14T00:00:00.000Z");

  it("assigns unique tags in priority order and falls back to Featured", () => {
    const featured = [
      note({
        id: "close",
        daysLeft: 2,
        annualReturn: 9.1,
        riskScore: "SME-2",
        publishedAt: "2026-09-12T00:00:00.000Z",
      }),
      note({
        id: "rate",
        daysLeft: 12,
        annualReturn: 9.1,
        riskScore: "SME-3",
        publishedAt: "2026-08-01T00:00:00.000Z",
      }),
      note({
        id: "grade",
        daysLeft: 12,
        annualReturn: 7.2,
        riskScore: "SME-1",
        publishedAt: "2026-08-01T00:00:00.000Z",
      }),
      note({
        id: "new",
        daysLeft: 12,
        annualReturn: 7.5,
        riskScore: "SME-4",
        publishedAt: "2026-09-10T00:00:00.000Z",
      }),
      note({
        id: "plain",
        daysLeft: 12,
        annualReturn: 7.1,
        riskScore: "SME-5",
        publishedAt: "2026-07-01T00:00:00.000Z",
      }),
    ];

    const tags = assignFeaturedMarketplaceTags(featured, now);
    expect(tags.get("close")).toBe("Closing soon");
    expect(tags.get("rate")).toBe("Highest rate");
    expect(tags.get("grade")).toBe("Top grade");
    expect(tags.get("new")).toBe("New listing");
    expect(tags.get("plain")).toBe("Featured");
    expect(deriveFeaturedMarketplaceTag(featured[0], featured, now)).toBe("Closing soon");
  });

  it("does not tag expired listings as closing soon", () => {
    const featured = [
      note({
        id: "expired",
        daysLeft: -1,
        annualReturn: 7.1,
        riskScore: "SME-5",
        publishedAt: "2026-07-01T00:00:00.000Z",
      }),
    ];
    expect(assignFeaturedMarketplaceTags(featured, now).get("expired")).not.toBe("Closing soon");
  });
});

describe("marketplaceSectorOptions", () => {
  it("returns industries in first-seen order without duplicates", () => {
    expect(
      marketplaceSectorOptions([
        note({ industry: "Manufacturing" }),
        note({ industry: " Healthcare " }),
        note({ industry: "Manufacturing" }),
        note({ industry: "  " }),
        note({ industry: null }),
      ])
    ).toEqual(["Manufacturing", "Healthcare"]);
  });
});

describe("marketplace card copy", () => {
  it("formats compact amounts and investor commitment for cards", () => {
    expect(formatCompactMarketplaceAmount(1_080_000)).toBe("RM 1.1m");
    expect(formatCompactMarketplaceAmount(405_000)).toBe("RM 405k");
    expect(formatCompactMarketplaceAmount(999_500)).toBe("RM 1.0m");
    expect(formatCompactMarketplaceAmount(500)).toBe("RM 500");
    expect(formatCompactMarketplaceAmountPair(1_080_000, 1_500_000)).toBe("RM 1.1m / 1.5m");
    expect(marketplaceInvestorSummary(note({ fundedAmount: 100, investorCount: 1 }))).toBe(
      "RM 100.00 committed by 1 investor"
    );
    expect(marketplaceInvestorSummary(note({ fundedAmount: 32000, investorCount: 3 }))).toBe(
      "RM 32,000.00 committed by 3 investors"
    );
    expect(marketplaceCardDaysLeftLabel(note({ daysLeft: 6 }))).toBe("6 days left");
    expect(marketplaceCardDaysLeftLabel(note({ daysLeft: null }))).toBe("Open");
    expect(marketplaceCardDaysLeftLabel(note({ listingKind: "funded" }))).toBe("Funding closed");
    expect(marketplaceCardRateLabel(note())).toBe("Up to");
    expect(marketplaceCardTenureLabel(note())).toBe("Tenure");
    expect(
      marketplaceCardRateLabel(
        note({
          timing: {
            ...TIMING,
            kind: "legacy",
            isTenureNote: false,
            compactLabel: "days left",
            tooltip: null,
          },
        })
      )
    ).toBe("Rate p.a.");
    expect(
      marketplaceCardTenureLabel(
        note({
          timing: {
            ...TIMING,
            kind: "legacy",
            isTenureNote: false,
            compactLabel: "days left",
            tooltip: null,
          },
        })
      )
    ).toBe("days left");
  });
});
