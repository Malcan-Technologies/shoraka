import type { MarketplaceNote } from "./marketplace-note-model";
import {
  marketplaceAvailableCashHint,
  marketplaceConfirmLead,
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
    issuerName: "Acme Sdn Bhd",
    noteTitle: "Acme invoice note",
    productName: "Invoice financing",
    industry: "Manufacturing",
    fundedAmount: 40000,
    goalAmount: 100000,
    remainingCapacity: 60000,
    fundingPercent: 40,
    annualReturn: 14.5,
    tenorDays: 45,
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
  it("names the issuer in a friendly lead", () => {
    expect(marketplaceInvestLead(note())).toBe("You're putting cash into Acme Sdn Bhd.");
    expect(marketplaceInvestLead(note({ issuerName: null }))).toBe(
      "Choose how much you'd like to invest in this note."
    );
  });

  it("joins the note reference and product", () => {
    expect(marketplaceInvestMeta(note())).toBe("Note 20260819-ABC · Invoice financing");
    expect(marketplaceInvestMeta(note({ productName: null }))).toBe("Note 20260819-ABC");
  });

  it("writes the confirmation and range in investor language", () => {
    expect(marketplaceConfirmLead("RM 10,000", note())).toBe(
      "You're about to commit RM 10,000 to Acme Sdn Bhd."
    );
    expect(marketplaceInvestRangeHint(note())).toBe(
      "Invest any amount from RM 1000 to RM 50000."
    );
    expect(marketplaceAvailableCashHint(12340)).toBe("Available cash RM 12340");
  });
});
