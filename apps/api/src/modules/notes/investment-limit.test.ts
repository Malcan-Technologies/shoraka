import {
  buildInvestmentHeadroom,
  investmentLimitExceededMessage,
} from "./investment-limit";

describe("buildInvestmentHeadroom", () => {
  it("computes invest and deposit headroom from outstanding principal, wallet, and pending deposits", () => {
    const result = buildInvestmentHeadroom({
      tier: "RETAIL",
      limit: 50_000,
      outstandingPrincipal: 40_000,
      walletBalance: 5_000,
      pendingDeposits: 2_000,
      minDepositAmount: 100,
      maxDepositAmount: 30_000,
    });

    expect(result.classificationRequired).toBe(false);
    expect(result.investHeadroom).toBe(10_000);
    expect(result.depositHeadroom).toBe(3_000);
    expect(result.depositMaxAmount).toBe(3_000);
    expect(result.limit).toBe(50_000);
  });

  it("floors headroom at 0 when outstanding already exceeds the limit", () => {
    const result = buildInvestmentHeadroom({
      tier: "RETAIL",
      limit: 50_000,
      outstandingPrincipal: 60_000,
      walletBalance: 10_000,
      pendingDeposits: 0,
      minDepositAmount: 100,
      maxDepositAmount: 30_000,
    });

    expect(result.investHeadroom).toBe(0);
    expect(result.depositHeadroom).toBe(0);
    expect(result.depositMaxAmount).toBe(0);
  });

  it("treats a null limit as unlimited and caps deposits only by the per-transaction max", () => {
    const result = buildInvestmentHeadroom({
      tier: "SOPHISTICATED",
      limit: null,
      outstandingPrincipal: 1_000_000,
      walletBalance: 50_000,
      pendingDeposits: 10_000,
      minDepositAmount: 100,
      maxDepositAmount: 30_000,
    });

    expect(result.limit).toBeNull();
    expect(result.investHeadroom).toBeNull();
    expect(result.depositHeadroom).toBeNull();
    expect(result.depositMaxAmount).toBe(30_000);
  });

  it("fails closed with zero limit and headroom when the investor type is missing", () => {
    const result = buildInvestmentHeadroom({
      classificationRequired: true,
      tier: "RETAIL",
      limit: 50_000,
      outstandingPrincipal: 10_000,
      walletBalance: 0,
      pendingDeposits: 0,
      minDepositAmount: 100,
      maxDepositAmount: 30_000,
    });

    expect(result.classificationRequired).toBe(true);
    expect(result.limit).toBe(0);
    expect(result.investHeadroom).toBe(0);
    expect(result.depositHeadroom).toBe(0);
    expect(result.depositMaxAmount).toBe(0);
  });

  it("fails closed even when the fallback tier would be unlimited", () => {
    const result = buildInvestmentHeadroom({
      classificationRequired: true,
      tier: "SOPHISTICATED",
      limit: null,
      outstandingPrincipal: 0,
      walletBalance: 0,
      pendingDeposits: 0,
      minDepositAmount: 100,
      maxDepositAmount: 30_000,
    });

    expect(result.limit).toBe(0);
    expect(result.depositMaxAmount).toBe(0);
  });

  it("caps depositMaxAmount at the platform per-transaction maximum", () => {
    const result = buildInvestmentHeadroom({
      tier: "ANGEL",
      limit: 500_000,
      outstandingPrincipal: 0,
      walletBalance: 0,
      pendingDeposits: 0,
      minDepositAmount: 100,
      maxDepositAmount: 30_000,
    });

    expect(result.investHeadroom).toBe(500_000);
    expect(result.depositHeadroom).toBe(500_000);
    expect(result.depositMaxAmount).toBe(30_000);
  });
});

describe("investmentLimitExceededMessage", () => {
  it("states remaining invest and deposit headroom with the type limit", () => {
    expect(
      investmentLimitExceededMessage({
        action: "invest",
        remaining: 30_000,
        tier: "RETAIL",
        limit: 50_000,
      })
    ).toBe("You can invest up to RM 30,000.00 more under your Retail limit of RM 50,000.00.");
    expect(
      investmentLimitExceededMessage({
        action: "deposit",
        remaining: 10_000,
        tier: "RETAIL",
        limit: 50_000,
      })
    ).toBe("You can deposit up to RM 10,000.00 more under your Retail limit of RM 50,000.00.");
  });
});
