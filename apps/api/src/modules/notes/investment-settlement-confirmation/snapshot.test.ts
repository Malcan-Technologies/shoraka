import {
  InvestorBalanceTransactionSource,
  NoteInvestmentStatus,
  NoteSettlementStatus,
} from "@prisma/client";
import { ConfirmationGenerationError } from "./types";

const mockPrisma: any = {
  noteSettlement: { findUnique: jest.fn() },
  noteInvestment: { findMany: jest.fn() },
  investorBalanceTransaction: { findMany: jest.fn() },
  issuerOrganization: { findUnique: jest.fn() },
  investorOrganization: { findUnique: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({ prisma: mockPrisma }));

import {
  buildInvestmentSettlementConfirmationSnapshot,
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

describe("buildInvestmentSettlementConfirmationSnapshot identifiers", () => {
  const issuerCuid = "cmknlimvf0003grp0hsbmc1dp";
  const investorCuid = "cmkm0fc2r00059v8jzc71b39c";
  const noteCuid = "cmtjz7ez50002ks59pu7j2xml";
  const settlementCuid = "cmtjz7ez5settlement00001";
  const investmentCuid = "cmtjz7ez5investment00001";
  const walletCuid = "cmtjz7ez5wallet00000001";

  function postedSettlement(overrides: Record<string, unknown> = {}) {
    return {
      id: settlementCuid,
      note_id: noteCuid,
      status: NoteSettlementStatus.POSTED,
      display_reference: "SET-ARF-202609-5O3",
      actual_settlement_date: new Date("2026-08-20T00:00:00.000Z"),
      posted_at: new Date("2026-08-22T09:00:00.000Z"),
      preview_snapshot: {
        allocations: [
          {
            investmentId: investmentCuid,
            investorOrganizationId: investorCuid,
            principal: 10000,
            profitNet: 850,
            tawidhInvestorShare: 0,
          },
        ],
      },
      note: {
        id: noteCuid,
        note_reference: "NOTE-ARF-202609-5O3",
        issuer_organization_id: issuerCuid,
        service_fee_rate_percent: 15,
        repaid_at: new Date("2026-08-22T09:00:00.000Z"),
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.noteSettlement.findUnique.mockResolvedValue(postedSettlement());
    mockPrisma.noteInvestment.findMany.mockResolvedValue([
      {
        id: investmentCuid,
        status: NoteInvestmentStatus.SETTLED,
        investor_organization_id: investorCuid,
      },
    ]);
    mockPrisma.investorBalanceTransaction.findMany.mockResolvedValue([
      {
        id: walletCuid,
        amount: 10850,
        source: InvestorBalanceTransactionSource.NOTE_INVESTMENT_RELEASE,
        metadata: { releaseReason: "SETTLEMENT_PAYOUT", settlementId: settlementCuid },
      },
    ]);
    mockPrisma.issuerOrganization.findUnique.mockResolvedValue({
      display_reference: "ISS-202608-DK3",
    });
    mockPrisma.investorOrganization.findUnique.mockResolvedValue({
      display_reference: "IVT-202609-A12",
    });
  });

  it("freezes note_reference and ISS-/IVT- display references, not Prisma IDs", async () => {
    const snapshot = await buildInvestmentSettlementConfirmationSnapshot({
      settlementId: settlementCuid,
      investorOrganizationId: investorCuid,
      source: "SETTLEMENT_POSTED",
    });
    expect(snapshot.noteReference).toBe("NOTE-ARF-202609-5O3");
    expect(snapshot.issuerReference).toBe("ISS-202608-DK3");
    expect(snapshot.investorReference).toBe("IVT-202609-A12");
    expect(snapshot.noteId).toBe(noteCuid);
    expect(snapshot.settlementId).toBe(settlementCuid);
    expect(snapshot.investorOrganizationId).toBe(investorCuid);
    expect(snapshot.principalReturned).toBe(10000);
    expect(snapshot.grossProfitEarned).toBe(1000);
    expect(snapshot.serviceFeeAmount).toBe(150);
    expect(snapshot.netProfitCredited).toBe(850);
    expect(snapshot.tawidhCompensation).toBe(0);
    expect(snapshot.totalCreditedToWallet).toBe(10850);
  });

  it("does not fall back to issuer or investor CUID when display_reference is missing", async () => {
    mockPrisma.issuerOrganization.findUnique.mockResolvedValue({ display_reference: null });
    mockPrisma.investorOrganization.findUnique.mockResolvedValue({ display_reference: "  " });
    const snapshot = await buildInvestmentSettlementConfirmationSnapshot({
      settlementId: settlementCuid,
      investorOrganizationId: investorCuid,
      source: "SETTLEMENT_POSTED",
    });
    expect(snapshot.issuerReference).toBe("—");
    expect(snapshot.issuerReference).not.toBe(issuerCuid);
    expect(snapshot.investorReference).toBe("—");
    expect(snapshot.investorReference).not.toBe(investorCuid);
    expect(snapshot.noteReference).toBe("NOTE-ARF-202609-5O3");
    expect(snapshot.totalCreditedToWallet).toBe(10850);
  });
});
