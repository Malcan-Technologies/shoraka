import { Prisma } from "@prisma/client";
import { buildFailFundingWalletCredits } from "./fail-funding-refunds";

describe("buildFailFundingWalletCredits", () => {
  it("credits each committed investment at its stored amount", () => {
    const credits = buildFailFundingWalletCredits([
      {
        id: "inv-a",
        investor_organization_id: "org-a",
        amount: new Prisma.Decimal("10000.500000"),
      },
      {
        id: "inv-b",
        investor_organization_id: "org-b",
        amount: new Prisma.Decimal("2500.000000"),
      },
      {
        id: "inv-c",
        investor_organization_id: "org-a",
        amount: 750,
      },
    ]);

    expect(credits).toEqual([
      {
        noteInvestmentId: "inv-a",
        investorOrganizationId: "org-a",
        amount: 10000.5,
        idempotencyKey: "investor-balance:release:fail-funding:inv-a",
      },
      {
        noteInvestmentId: "inv-b",
        investorOrganizationId: "org-b",
        amount: 2500,
        idempotencyKey: "investor-balance:release:fail-funding:inv-b",
      },
      {
        noteInvestmentId: "inv-c",
        investorOrganizationId: "org-a",
        amount: 750,
        idempotencyKey: "investor-balance:release:fail-funding:inv-c",
      },
    ]);
    expect(credits.reduce((sum, credit) => sum + credit.amount, 0)).toBe(13250.5);
  });

  it("skips zero or invalid committed amounts", () => {
    expect(
      buildFailFundingWalletCredits([
        { id: "inv-zero", investor_organization_id: "org-a", amount: 0 },
        { id: "inv-empty", investor_organization_id: "org-b", amount: null },
      ])
    ).toEqual([]);
  });
});
