import { ConfirmationGenerationError } from "./types";
import {
  deriveInvestorGrossAndServiceFee,
  expectedInvestorOrganizationIds,
  groupAllocationsByInvestorOrg,
  parseSettlementAllocations,
  reconcileInvestorConfirmationAmounts,
  resolveConfirmationSettlementDate,
  sumAllocationAmounts,
} from "./snapshot";

describe("parseSettlementAllocations", () => {
  it("reads frozen allocation rows from the posted preview snapshot", () => {
    const rows = parseSettlementAllocations({
      allocations: [
        {
          investmentId: "inv-a",
          investorOrganizationId: "org-a",
          principal: 10000,
          profitNet: 675,
          tawidhInvestorShare: 0,
        },
      ],
    });
    expect(rows).toEqual([
      {
        investmentId: "inv-a",
        investorOrganizationId: "org-a",
        principal: 10000,
        profitNet: 675,
        tawidhInvestorShare: 0,
      },
    ]);
  });
});

describe("grouping and sums", () => {
  const rows = [
    {
      investmentId: "inv-1",
      investorOrganizationId: "org-a",
      principal: 4000,
      profitNet: 200,
      tawidhInvestorShare: 10,
    },
    {
      investmentId: "inv-2",
      investorOrganizationId: "org-a",
      principal: 6000,
      profitNet: 300,
      tawidhInvestorShare: 15,
    },
    {
      investmentId: "inv-3",
      investorOrganizationId: "org-b",
      principal: 5000,
      profitNet: 100,
      tawidhInvestorShare: 0,
    },
  ];

  it("aggregates multiple investment rows for one investor organization", () => {
    const grouped = groupAllocationsByInvestorOrg(rows);
    const orgA = sumAllocationAmounts(grouped.get("org-a") ?? []);
    expect(orgA.principalReturned).toBe(10000);
    expect(orgA.netProfitCredited).toBe(500);
    expect(orgA.tawidhCompensation).toBe(25);
    expect(orgA.totalCreditedToWallet).toBe(10525);
    expect(orgA.investmentIds).toEqual(["inv-1", "inv-2"]);
  });

  it("emits one expected org per investor with a material payout", () => {
    expect(expectedInvestorOrganizationIds(rows)).toEqual(["org-a", "org-b"]);
  });
});

describe("deriveInvestorGrossAndServiceFee", () => {
  it("reuses the note service fee rate and does not hardcode 10%", () => {
    const fifteen = deriveInvestorGrossAndServiceFee({
      netProfitCredited: 850,
      serviceFeeRatePercent: 15,
    });
    expect(fifteen.grossProfitEarned).toBe(1000);
    expect(fifteen.serviceFeeAmount).toBe(150);

    const ten = deriveInvestorGrossAndServiceFee({
      netProfitCredited: 900,
      serviceFeeRatePercent: 10,
    });
    expect(ten.grossProfitEarned).toBe(1000);
    expect(ten.serviceFeeAmount).toBe(100);

    const zero = deriveInvestorGrossAndServiceFee({
      netProfitCredited: 500,
      serviceFeeRatePercent: 0,
    });
    expect(zero.grossProfitEarned).toBe(500);
    expect(zero.serviceFeeAmount).toBe(0);
  });
});

describe("reconcileInvestorConfirmationAmounts", () => {
  it("accepts principal + net + Ta’widh equal to the wallet payout", () => {
    expect(() =>
      reconcileInvestorConfirmationAmounts({
        grossProfitEarned: 1000,
        serviceFeeAmount: 150,
        netProfitCredited: 850,
        principalReturned: 10000,
        tawidhCompensation: 25,
        totalCreditedToWallet: 10875,
        walletCreditAmount: 10875,
      })
    ).not.toThrow();
  });

  it("rejects a total that omits Ta’widh or mismatches the wallet", () => {
    expect(() =>
      reconcileInvestorConfirmationAmounts({
        grossProfitEarned: 1000,
        serviceFeeAmount: 150,
        netProfitCredited: 850,
        principalReturned: 10000,
        tawidhCompensation: 25,
        totalCreditedToWallet: 10850,
        walletCreditAmount: 10875,
      })
    ).toThrow(ConfirmationGenerationError);
  });
});

describe("resolveConfirmationSettlementDate", () => {
  it("prefers actual_settlement_date over posted_at", () => {
    const resolved = resolveConfirmationSettlementDate({
      actualSettlementDate: "2026-08-20T00:00:00.000Z",
      postedAt: "2026-08-22T09:00:00.000Z",
      repaidAt: "2026-08-22T09:00:00.000Z",
    });
    expect(resolved.settlementDateSource).toBe("ACTUAL_SETTLEMENT_DATE");
    expect(resolved.settlementDateDisplay).toBe("20 Aug 2026");
  });

  it("falls back to posted_at then repaid_at", () => {
    expect(
      resolveConfirmationSettlementDate({
        postedAt: "2026-08-22T09:00:00.000Z",
      }).settlementDateSource
    ).toBe("POSTED_AT");
    expect(
      resolveConfirmationSettlementDate({
        repaidAt: "2026-08-23T09:00:00.000Z",
      }).settlementDateSource
    ).toBe("REPAID_AT");
  });
});
