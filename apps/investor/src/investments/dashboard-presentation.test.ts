import type { NoteListItem } from "@cashsouk/types";
import {
  atRiskNoteCountCopy,
  cashflowBarPercent,
  dualSeriesChartPaths,
  HOLDINGS_PREVIEW_LIMIT,
  idleDaysCopy,
  marketplaceOpenTotals,
  monthBucketLabel,
  tenorProgressPercent,
} from "./dashboard-presentation";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
}));

function note(overrides: Partial<NoteListItem> = {}): NoteListItem {
  return {
    id: "note_1",
    noteReference: "NOTE-1",
    title: "Note",
    productCategory: null,
    productName: "Invoice financing",
    issuerIndustry: null,
    sourceApplicationId: "app_1",
    sourceApplicationDisplayReference: null,
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: "inv_1",
    sourceInvoiceDisplayReference: null,
    issuerOrganizationId: "org_1",
    issuerOrganizationDisplayReference: null,
    issuerName: "Acme",
    paymasterName: null,
    riskRating: "SME-3",
    status: "ACTIVE" as NoteListItem["status"],
    listingStatus: "CLOSED" as NoteListItem["listingStatus"],
    fundingStatus: "FUNDED" as NoteListItem["fundingStatus"],
    servicingStatus: "CURRENT" as NoteListItem["servicingStatus"],
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    investorCount: 1,
    tenureDays: 60,
    maturityDate: "2026-09-19",
    listingClosesAt: null,
    activatedAt: "2026-07-21",
    publishedAt: "2026-07-01",
    fundingClosedAt: "2026-07-15",
    repaidAt: null,
    settlementSummary: null,
    createdAt: "2026-07-01",
    updatedAt: "2026-07-21",
    requestedAmount: 10000,
    invoiceAmount: 12000,
    settlementAmount: 10000,
    targetAmount: 10000,
    fundedAmount: 10000,
    fundingPercent: 100,
    minimumFundingPercent: 80,
    profitRatePercent: 12,
    platformFeeRatePercent: 1,
    serviceFeeRatePercent: 0,
    investorRepaymentSummary: null,
    ...overrides,
  };
}

describe("dashboard presentation", () => {
  it("omits idle copy when idle days are unknown", () => {
    expect(idleDaysCopy(null)).toBeNull();
    expect(idleDaysCopy(6)).toBe("idle 6 days");
    expect(idleDaysCopy(1)).toBe("idle 1 day");
  });

  it("labels at-risk holdings as notes at risk", () => {
    expect(atRiskNoteCountCopy(1)).toBe("1 note at risk");
    expect(atRiskNoteCountCopy(2)).toBe("2 notes at risk");
  });

  it("hides the value-over-time series when history is shorter than 2 points", () => {
    expect(dualSeriesChartPaths([100])).toBeNull();
    expect(dualSeriesChartPaths([100, 120])?.line).toContain("M");
  });

  it("computes tenor progress from remaining Malaysia calendar days", () => {
    const now = new Date("2026-09-14T00:00:00.000Z");
    expect(tenorProgressPercent(note({ tenureDays: 60, maturityDate: "2026-09-19" }), now)).toBe(92);
    expect(
      tenorProgressPercent(
        note({
          status: "REPAID" as NoteListItem["status"],
          servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
        }),
        now
      )
    ).toBe(100);
  });

  it("only reports seeking-funding totals when the fetched set is complete", () => {
    expect(marketplaceOpenTotals([{ remainingCapacity: 100 }, { remainingCapacity: 50 }], 2)).toEqual(
      { count: 2, seekingFunding: 150 }
    );
    expect(marketplaceOpenTotals([{ remainingCapacity: 100 }], 4)).toEqual({
      count: 4,
      seekingFunding: null,
    });
  });

  it("sizes cashflow bars against the peak month", () => {
    expect(cashflowBarPercent(50, 100)).toBe(50);
    expect(cashflowBarPercent(0, 100)).toBe(0);
    expect(monthBucketLabel("Sep 2026")).toBe("Sep");
  });

  it("previews three holdings and leaves the rest on the portfolio page", () => {
    expect(HOLDINGS_PREVIEW_LIMIT).toBe(3);
  });
});
