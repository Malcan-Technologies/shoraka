import {
  collectCapacityOverLimitRows,
  CONTRACT_CAPACITY_RECOMPUTE_WHERE,
  listContractsForCapacityRecompute,
  recomputeContractCapacitySnapshots,
} from "./recompute-contract-facility";

describe("contract capacity recompute", () => {
  it("selects approved, amendment, and invoice-linked facilities", () => {
    expect(CONTRACT_CAPACITY_RECOMPUTE_WHERE).toEqual({
      OR: [{ status: { in: ["APPROVED", "AMENDMENT_REQUESTED"] } }, { invoices: { some: {} } }],
    });
  });

  it("asks Prisma for approved, amended, and linked facilities", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await listContractsForCapacityRecompute({ contract: { findMany } });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: CONTRACT_CAPACITY_RECOMPUTE_WHERE,
      })
    );
  });

  it("does not persist during dry-run and reports legacy negative remaining", async () => {
    const persist = jest.fn();
    const report = await recomputeContractCapacitySnapshots({
      dryRun: true,
      listContracts: async () => [
        {
          id: "legacy-over",
          status: "APPROVED",
          display_reference: "CON-LEGACY",
          contract_details: { approved_facility: 50_000, value: 200_000 },
          approved_facility: 50_000,
          utilized_facility: 80_000,
          available_facility: -30_000,
          lifetime_remaining: -12.5,
        },
      ],
      loadSiblings: async () => ({
        invoices: [
          {
            id: "inv-1",
            status: "APPROVED",
            details: { value: 220_000 },
            offer_details: { offered_amount: 80_000 },
          },
        ],
        notes: [],
      }),
      persist,
    });

    expect(persist).not.toHaveBeenCalled();
    expect(report.wrote).toBe(0);
    expect(report.scanned).toBe(1);
    expect(report.overLimit).toEqual([
      {
        id: "legacy-over",
        ref: "CON-LEGACY",
        availableFacility: -30_000,
        lifetimeRemaining: -20_000,
      },
    ]);
    expect(report.rows[0]?.after.availableFacility).toBe(-30_000);
    expect(report.rows[0]?.after.lifetimeUsed).toBe(220_000);
  });

  it("writes on apply and includes amended plus invoice-linked rows", async () => {
    const persist = jest.fn();
    const report = await recomputeContractCapacitySnapshots({
      dryRun: false,
      listContracts: async () => [
        {
          id: "amended",
          status: "AMENDMENT_REQUESTED",
          display_reference: "CON-AMD",
          contract_details: { approved_facility: 100_000, value: 500_000 },
        },
        {
          id: "linked-only",
          status: "APPROVED",
          display_reference: "CON-LINK",
          contract_details: { approved_facility: 80_000, financing: 40_000, value: 200_000 },
        },
      ],
      loadSiblings: async (id) =>
        id === "amended"
          ? {
              invoices: [
                {
                  id: "inv-live",
                  status: "APPROVED",
                  details: { value: 80_000 },
                  offer_details: { offered_amount: 40_000 },
                },
              ],
              notes: [
                {
                  source_invoice_id: "inv-live",
                  status: "ACTIVE",
                  servicing_status: "CURRENT",
                  funding_status: "FUNDED",
                  funded_amount: 40_000,
                  target_amount: 40_000,
                },
              ],
            }
          : {
              invoices: [
                {
                  id: "inv-pending",
                  status: "SUBMITTED",
                  details: { value: 50_000, applied_financing: 20_000 },
                  offer_details: null,
                },
              ],
              notes: [],
            },
      persist,
    });

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenCalledWith("amended");
    expect(persist).toHaveBeenCalledWith("linked-only");
    expect(report.wrote).toBe(2);
    expect(report.rows.find((row) => row.id === "amended")?.after.approvedFacility).toBe(100_000);
    expect(report.rows.find((row) => row.id === "linked-only")?.after.pendingFacility).toBe(20_000);
    expect(collectCapacityOverLimitRows(report.overLimit)).toEqual([]);
  });
});
