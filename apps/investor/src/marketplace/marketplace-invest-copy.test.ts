import { resolveNoteTimingDisplay } from "@cashsouk/types";
import type { MarketplaceNote } from "./marketplace-note-model";
import {
  marketplaceAvailableCashHint,
  marketplaceConfirmLead,
  marketplaceConfirmReturnHint,
  marketplaceInvestLead,
  marketplaceInvestMeta,
  marketplaceInvestRangeHint,
} from "./marketplace-invest-copy";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
}));

function note(overrides: Partial<MarketplaceNote> = {}): MarketplaceNote {
  return {
    id: "note_1",
    noteCode: "NOTE-20260819-ABC",
    purposeOfFinancing: "Working capital for a new contract",
    contractTitle: "Mining Rig Repair 12654",
    purposeOfContract: "Repair and maintenance for 12 mining rigs",
    noteTitle: "Invoice note",
    productName: "Invoice financing",
    productImageS3Key: null,
    productImageUrl: null,
    industry: "Manufacturing",
    fundedAmount: 40000,
    goalAmount: 100000,
    remainingCapacity: 60000,
    fundingPercent: 40,
    annualReturn: 14.5,
    tenorDays: 45,
    timing: resolveNoteTimingDisplay({ tenureDays: 45, maturityDate: null }),
    riskScore: "B",
    daysLeft: 6,
    minInvestment: 1000,
    maxInvestment: 50000,
    minimumFundingPercent: 80,
    investable: true,
    investorCount: 3,
    listingKind: "open",
    ...overrides,
  };
}

describe("marketplace invest copy", () => {
  it("keeps the invest lead free of issuer identity", () => {
    expect(marketplaceInvestLead()).toBe(
      "Choose how much you'd like to invest in this note."
    );
  });

  it("joins the note reference and product", () => {
    expect(marketplaceInvestMeta(note())).toBe("Note 20260819-ABC · Invoice financing");
    expect(marketplaceInvestMeta(note({ productName: null }))).toBe("Note 20260819-ABC");
  });

  it("writes the confirmation and range in investor language", () => {
    expect(marketplaceConfirmLead("RM 10,000")).toBe(
      "You're about to commit RM 10,000 to this note."
    );
    expect(marketplaceInvestRangeHint(note())).toBe(
      "Invest any amount from RM 1000 to RM 50000."
    );
    expect(marketplaceAvailableCashHint(12340)).toBe("Available cash RM 12340");
    expect(marketplaceConfirmReturnHint(note())).toBe(
      "45 days from disbursement. Advertised return is up to 14.5% p.a. before the service fee, for the days profit actually runs."
    );
  });
});
