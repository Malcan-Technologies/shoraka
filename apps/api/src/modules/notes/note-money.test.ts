import {
  allocateProRataNoteMoney,
  buildInvestorPortfolioTotals,
  buildSettlementInvestorAllocations,
  computeMarketplaceCommitBounds,
  isNoteMoneyAmount,
  maxFundedBeforeMarketplaceCommit,
  meetsMinimumFunding,
  NOTE_MONEY_TOLERANCE,
  normalizeNoteCapacityAmount,
} from "@cashsouk/types";

describe("note money helpers", () => {
  it("rejects amounts with more than two decimal places", () => {
    expect(isNoteMoneyAmount(100)).toBe(true);
    expect(isNoteMoneyAmount(100.5)).toBe(true);
    expect(isNoteMoneyAmount(100.55)).toBe(true);
    expect(isNoteMoneyAmount(100.555)).toBe(false);
    expect(isNoteMoneyAmount(100.001)).toBe(false);
  });

  it("rounds marketplace remaining capacity to two decimals", () => {
    const bounds = computeMarketplaceCommitBounds(100000.007, 0);
    expect(bounds.remainingCapacity).toBe(100000.01);
    expect(bounds.maxCommit).toBe(100000.01);
  });

  it("allows investing the displayed max when funded has sub-cent drift", () => {
    const target = 100_000;
    const fundedLedger = 52_193.271;
    const fundedDisplay = normalizeNoteCapacityAmount(fundedLedger);
    expect(fundedDisplay).toBe(52_193.27);

    const bounds = computeMarketplaceCommitBounds(target, fundedDisplay);
    expect(bounds.maxCommit).toBe(47_806.73);

    const maxFunded = maxFundedBeforeMarketplaceCommit(target, bounds.maxCommit);
    expect(fundedLedger).toBeLessThanOrEqual(maxFunded);
    expect(bounds.maxCommit + NOTE_MONEY_TOLERANCE).toBeGreaterThanOrEqual(bounds.maxCommit);
  });

  it("treats funding near threshold as met with tolerance", () => {
    expect(meetsMinimumFunding(79999.5, 100000, 80)).toBe(true);
    expect(meetsMinimumFunding(79990, 100000, 80)).toBe(false);
  });

  it("reconciles portfolio total with visible parts", () => {
    const totals = buildInvestorPortfolioTotals(50.004, 100.004);
    expect(totals.availableBalance).toBe(50);
    expect(totals.totalInvestment).toBe(100);
    expect(totals.portfolioTotal).toBe(150);
  });

  it("allocates profit cents so lines sum to the pool total", () => {
    const shares = allocateProRataNoteMoney(8500, [33333.33, 66666.67]);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(8500);
  });

  it("scales principal pro-rata on partial receipts", () => {
    const allocations = buildSettlementInvestorAllocations({
      investments: [
        {
          investmentId: "a",
          investorOrganizationId: "org-a",
          amount: 50000,
        },
        {
          investmentId: "b",
          investorOrganizationId: "org-b",
          amount: 50000,
        },
      ],
      investorPrincipal: 60000,
      investorProfitNet: 8500,
    });

    expect(allocations.reduce((sum, row) => sum + row.principal, 0)).toBe(60000);
    expect(allocations.reduce((sum, row) => sum + row.profitNet, 0)).toBe(8500);
    expect(allocations[0]?.principal).toBe(30000);
    expect(allocations[1]?.principal).toBe(30000);
  });
});
