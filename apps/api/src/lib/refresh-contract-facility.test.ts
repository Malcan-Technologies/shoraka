import * as fs from "fs";
import * as path from "path";
import { Prisma } from "@prisma/client";
import { CAPACITY_SNAPSHOT_VERSION, CAPACITY_SNAPSHOT_VERSION_KEY } from "@cashsouk/types";
import { emptyCapacitySnapshot } from "./contract-facility";
import {
  mapInvoicesWithNotes,
  overlayReadCapacityOnApplicationContract,
  overlayReadCapacityOnContracts,
  overlayStoredCapacityOnApplicationContract,
  overlayStoredCapacityOnContractDetails,
  persistCapacitySnapshotData,
  storedCapacityFromContract,
  type ContractCapacityReadDb,
} from "./refresh-contract-facility";

describe("mapInvoicesWithNotes", () => {
  it("attaches occupancy notes by source invoice id", () => {
    const mapped = mapInvoicesWithNotes(
      [
        {
          id: "inv-1",
          status: "APPROVED",
          details: { value: 100 },
          offer_details: { offered_amount: 60 },
        },
        {
          id: "inv-2",
          status: "SUBMITTED",
          details: { value: 200 },
          offer_details: null,
        },
      ],
      [
        {
          source_invoice_id: "inv-1",
          status: "ACTIVE",
          servicing_status: "CURRENT",
          funding_status: "FUNDED",
          funded_amount: 60,
          target_amount: 60,
        },
      ]
    );

    expect(mapped[0]?.note?.status).toBe("ACTIVE");
    expect(mapped[0]?.note?.fundedAmount).toBe(60);
    expect(mapped[1]?.note).toBeNull();
  });
});

describe("persistCapacitySnapshotData", () => {
  it("writes typed columns and keeps JSON occupancy fields in sync", () => {
    const snapshot = {
      ...emptyCapacitySnapshot(),
      approvedFacility: 100_000,
      utilizedFacility: 40_000,
      pendingFacility: 15_000,
      availableFacility: 45_000,
      lifetimeCap: 500_000,
      lifetimeUsed: 120_000,
      lifetimeRemaining: 380_000,
      requestedFacility: 90_000,
      contractValue: 500_000,
    };
    const data = persistCapacitySnapshotData({ title: "Keep me", approved_facility: 1 }, snapshot);
    const details = data.contract_details as Record<string, unknown>;

    expect(data.approved_facility).toEqual(new Prisma.Decimal("100000.000000"));
    expect(data.available_facility).toEqual(new Prisma.Decimal("45000.000000"));
    expect(data.lifetime_remaining).toEqual(new Prisma.Decimal("380000.000000"));
    expect(details.title).toBe("Keep me");
    expect(details.pending_facility).toBe(15_000);
    expect(details.lifetime_used).toBe(120_000);
    expect(details[CAPACITY_SNAPSHOT_VERSION_KEY]).toBe(CAPACITY_SNAPSHOT_VERSION);
  });

  it("writes the snapshot marker when pending and remaining are zero", () => {
    const data = persistCapacitySnapshotData(
      { title: "Keep me" },
      {
        ...emptyCapacitySnapshot(),
        approvedFacility: 100_000,
        availableFacility: 0,
        lifetimeCap: 500_000,
        lifetimeUsed: 500_000,
        lifetimeRemaining: 0,
        contractValue: 500_000,
      }
    );
    const details = data.contract_details as Record<string, unknown>;
    expect(details.pending_facility).toBe(0);
    expect(details.available_facility).toBe(0);
    expect(details.lifetime_remaining).toBe(0);
    expect(details[CAPACITY_SNAPSHOT_VERSION_KEY]).toBe(CAPACITY_SNAPSHOT_VERSION);
  });
});

describe("storedCapacityFromContract", () => {
  it("falls back to JSON when typed columns are still zero", () => {
    const stored = storedCapacityFromContract({
      approved_facility: 0,
      utilized_facility: 0,
      available_facility: 0,
      contract_details: {
        approved_facility: 100_000,
        utilized_facility: 130_000,
        available_facility: -30_000,
        financing: 80_000,
        value: 500_000,
      },
    });

    expect(stored.approvedFacility).toBe(100_000);
    expect(stored.utilizedFacility).toBe(130_000);
    expect(stored.availableFacility).toBe(-30_000);
    expect(stored.requestedFacility).toBe(80_000);
    expect(stored.contractValue).toBe(500_000);
  });

  it("preserves negative typed over-limit values", () => {
    const stored = storedCapacityFromContract({
      available_facility: new Prisma.Decimal("-30000.000000"),
      lifetime_remaining: new Prisma.Decimal("-12.500000"),
      contract_details: { available_facility: 0, lifetime_remaining: 0 },
    });
    expect(stored.availableFacility).toBe(-30_000);
    expect(stored.lifetimeRemaining).toBe(-12.5);
  });

  it("derives lifetime cap from contract face when snapshot fields are missing", () => {
    const stored = storedCapacityFromContract({
      lifetime_cap: 0,
      lifetime_used: 0,
      lifetime_remaining: 0,
      contract_details: { value: 500_000, financing: 80_000 },
    });

    expect(stored.contractValue).toBe(500_000);
    expect(stored.lifetimeCap).toBe(500_000);
    expect(stored.lifetimeUsed).toBe(0);
    expect(stored.lifetimeRemaining).toBe(500_000);
  });

  it("derives remaining as cap minus used before a lifetime snapshot exists", () => {
    const stored = storedCapacityFromContract({
      lifetime_cap: 0,
      lifetime_used: 120_000,
      lifetime_remaining: 0,
      contract_details: { value: 500_000 },
    });

    expect(stored.lifetimeCap).toBe(500_000);
    expect(stored.lifetimeUsed).toBe(120_000);
    expect(stored.lifetimeRemaining).toBe(380_000);
    expect(stored.contractValue).toBe(500_000);
  });

  it("treats marked typed zeros as authoritative over stale JSON occupancy", () => {
    const stored = storedCapacityFromContract({
      pending_facility: 0,
      available_facility: 100_000,
      lifetime_cap: 500_000,
      lifetime_used: 0,
      lifetime_remaining: 500_000,
      contract_details: {
        pending_facility: 40_000,
        available_facility: 60_000,
        [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
      },
    });
    expect(stored.pendingFacility).toBe(0);
    expect(stored.availableFacility).toBe(100_000);
    expect(stored.lifetimeRemaining).toBe(500_000);
  });

  it("keeps a legitimate exhausted remaining of zero after a marked snapshot exists", () => {
    const stored = storedCapacityFromContract({
      lifetime_cap: 500_000,
      lifetime_used: 500_000,
      lifetime_remaining: 0,
      contract_details: {
        value: 500_000,
        lifetime_cap: 500_000,
        lifetime_used: 500_000,
        lifetime_remaining: 0,
        [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
      },
    });

    expect(stored.contractValue).toBe(500_000);
    expect(stored.lifetimeCap).toBe(500_000);
    expect(stored.lifetimeUsed).toBe(500_000);
    expect(stored.lifetimeRemaining).toBe(0);
  });
});

describe("overlayStoredCapacityOnContractDetails", () => {
  it("writes typed occupancy onto contract_details for issuer reads", () => {
    const overlaid = overlayStoredCapacityOnContractDetails({
      approved_facility: 100_000,
      utilized_facility: 40_000,
      pending_facility: 15_000,
      repaid_facility: 5_000,
      available_facility: 45_000,
      lifetime_cap: 500_000,
      lifetime_used: 120_000,
      lifetime_remaining: 380_000,
      contract_details: {
        title: "Keep me",
        approved_facility: 1,
        available_facility: 99,
      },
    });
    const details = overlaid.contract_details as Record<string, unknown>;
    expect(details.title).toBe("Keep me");
    expect(details.approved_facility).toBe(100_000);
    expect(details.pending_facility).toBe(15_000);
    expect(details.available_facility).toBe(45_000);
    expect(details.lifetime_used).toBe(120_000);
    expect(details.lifetime_remaining).toBe(380_000);
  });

  it("overlays the nested contract on issuer application reads", () => {
    const overlaid = overlayStoredCapacityOnApplicationContract({
      id: "app-1",
      contract: {
        approved_facility: 80_000,
        available_facility: 80_000,
        contract_details: { title: "Facility" },
      },
    });
    expect((overlaid.contract?.contract_details as Record<string, unknown>).available_facility).toBe(
      80_000
    );
  });

  it("does not write lifetime zeros over contract face before backfill", () => {
    const overlaid = overlayStoredCapacityOnContractDetails({
      lifetime_cap: 0,
      lifetime_used: 0,
      lifetime_remaining: 0,
      contract_details: { title: "Keep me", value: 500_000 },
    });
    const details = overlaid.contract_details as Record<string, unknown>;
    expect(details.title).toBe("Keep me");
    expect(details.value).toBe(500_000);
    expect(details.lifetime_cap).toBe(500_000);
    expect(details.lifetime_used).toBe(0);
    expect(details.lifetime_remaining).toBe(500_000);
  });

  it("does not materialize pending=0 from unmarked typed zeros", () => {
    const overlaid = overlayStoredCapacityOnContractDetails({
      approved_facility: 0,
      utilized_facility: 0,
      pending_facility: 0,
      repaid_facility: 0,
      available_facility: 0,
      lifetime_cap: 0,
      lifetime_used: 0,
      lifetime_remaining: 0,
      contract_details: { title: "Keep me", value: 500_000, available_facility: 100_000 },
    });
    const details = overlaid.contract_details as Record<string, unknown>;
    expect(details.title).toBe("Keep me");
    expect(details.available_facility).toBe(100_000);
    expect(details).not.toHaveProperty("pending_facility");
    expect(details).not.toHaveProperty(CAPACITY_SNAPSHOT_VERSION_KEY);
  });

  it("overlays a marked remaining of zero without clobbering contract value", () => {
    const overlaid = overlayStoredCapacityOnContractDetails({
      lifetime_cap: 500_000,
      lifetime_used: 500_000,
      lifetime_remaining: 0,
      pending_facility: 0,
      available_facility: 0,
      contract_details: {
        value: 500_000,
        lifetime_cap: 500_000,
        lifetime_used: 500_000,
        lifetime_remaining: 0,
        pending_facility: 0,
        available_facility: 0,
        [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
      },
    });
    const details = overlaid.contract_details as Record<string, unknown>;
    expect(details.value).toBe(500_000);
    expect(details.lifetime_cap).toBe(500_000);
    expect(details.lifetime_remaining).toBe(0);
    expect(details.pending_facility).toBe(0);
    expect(details.available_facility).toBe(0);
  });
});

function liveCapacityDb(options: {
  invoices?: Array<{
    id: string;
    contract_id: string | null;
    status: string;
    details: unknown;
    offer_details: unknown;
  }>;
  notes?: Array<{
    source_invoice_id: string | null;
    status: string;
    servicing_status: string;
    funding_status: string;
    listing_status?: string | null;
    funded_amount: unknown;
    target_amount: unknown;
  }>;
}): ContractCapacityReadDb & {
  invoice: { findMany: jest.Mock };
  note: { findMany: jest.Mock };
} {
  return {
    invoice: { findMany: jest.fn().mockResolvedValue(options.invoices ?? []) },
    note: { findMany: jest.fn().mockResolvedValue(options.notes ?? []) },
  };
}

describe("overlayReadCapacityOnContracts", () => {
  const unmarkedFacility = {
    id: "con-1",
    status: "APPROVED",
    approved_facility: 0,
    utilized_facility: 0,
    pending_facility: 0,
    available_facility: 0,
    lifetime_cap: 0,
    lifetime_used: 0,
    lifetime_remaining: 0,
    contract_details: {
      title: "Keep me",
      value: 1_000_000,
      financing: 200_000,
      approved_facility: 100_000,
      available_facility: 100_000,
    },
  };

  it("recomputes unmarked occupancy from sibling submitted invoices", async () => {
    const db = liveCapacityDb({
      invoices: [
        {
          id: "inv-1",
          contract_id: "con-1",
          status: "SUBMITTED",
          details: { value: 80_000, applied_financing: 40_000 },
          offer_details: null,
        },
        {
          id: "inv-2",
          contract_id: "con-1",
          status: "SUBMITTED",
          details: { value: 60_000, applied_financing: 30_000 },
          offer_details: null,
        },
      ],
    });

    const [overlaid] = await overlayReadCapacityOnContracts(db, [unmarkedFacility]);
    const details = overlaid.contract_details as Record<string, unknown>;

    expect(db.invoice.findMany).toHaveBeenCalledTimes(1);
    expect(details.title).toBe("Keep me");
    expect(details.pending_facility).toBe(70_000);
    expect(details.available_facility).toBe(30_000);
    expect(details.lifetime_used).toBe(140_000);
    expect(details.lifetime_remaining).toBe(860_000);
    expect(details).not.toHaveProperty(CAPACITY_SNAPSHOT_VERSION_KEY);
  });

  it("keeps settled lifetime after revolving credit is released", async () => {
    const db = liveCapacityDb({
      invoices: [
        {
          id: "inv-settled",
          contract_id: "con-1",
          status: "APPROVED",
          details: { value: 250_000 },
          offer_details: { offered_amount: 80_000 },
        },
      ],
      notes: [
        {
          source_invoice_id: "inv-settled",
          status: "REPAID",
          servicing_status: "SETTLED",
          funding_status: "FUNDED",
          funded_amount: 80_000,
          target_amount: 80_000,
        },
      ],
    });

    const [overlaid] = await overlayReadCapacityOnContracts(db, [unmarkedFacility]);
    const details = overlaid.contract_details as Record<string, unknown>;
    expect(details.available_facility).toBe(100_000);
    expect(details.utilized_facility).toBe(0);
    expect(details.repaid_facility).toBe(80_000);
    expect(details.lifetime_used).toBe(250_000);
    expect(details.lifetime_remaining).toBe(750_000);
  });

  it("releases failed funding from both ledgers on the unmarked live read", async () => {
    const db = liveCapacityDb({
      invoices: [
        {
          id: "inv-fail",
          contract_id: "con-1",
          status: "APPROVED",
          details: { value: 300_000 },
          offer_details: { offered_amount: 90_000 },
        },
      ],
      notes: [
        {
          source_invoice_id: "inv-fail",
          status: "FAILED_FUNDING",
          servicing_status: "CURRENT",
          funding_status: "FAILED",
          funded_amount: 10_000,
          target_amount: 90_000,
        },
      ],
    });

    const [overlaid] = await overlayReadCapacityOnContracts(db, [unmarkedFacility]);
    const details = overlaid.contract_details as Record<string, unknown>;
    expect(details.pending_facility).toBe(0);
    expect(details.utilized_facility).toBe(0);
    expect(details.available_facility).toBe(100_000);
    expect(details.lifetime_used).toBe(0);
    expect(details.lifetime_remaining).toBe(1_000_000);
  });

  it("uses the marked typed/JSON overlay and skips sibling source queries", async () => {
    const db = liveCapacityDb({
      invoices: [
        {
          id: "inv-1",
          contract_id: "con-1",
          status: "SUBMITTED",
          details: { value: 80_000, applied_financing: 40_000 },
          offer_details: null,
        },
      ],
    });
    const marked = {
      id: "con-1",
      status: "APPROVED",
      approved_facility: 100_000,
      utilized_facility: 0,
      pending_facility: 0,
      available_facility: 100_000,
      lifetime_cap: 500_000,
      lifetime_used: 0,
      lifetime_remaining: 500_000,
      contract_details: {
        title: "Marked",
        value: 500_000,
        approved_facility: 1,
        pending_facility: 9,
        available_facility: 99,
        [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
      },
    };

    const [overlaid] = await overlayReadCapacityOnContracts(db, [marked]);
    const details = overlaid.contract_details as Record<string, unknown>;
    expect(db.invoice.findMany).not.toHaveBeenCalled();
    expect(db.note.findMany).not.toHaveBeenCalled();
    expect(details.pending_facility).toBe(0);
    expect(details.available_facility).toBe(100_000);
    expect(details.title).toBe("Marked");
  });

  it("overlays live remaining onto an existing-facility application payload", async () => {
    const db = liveCapacityDb({
      invoices: [
        {
          id: "inv-1",
          contract_id: "con-1",
          status: "SUBMITTED",
          details: { value: 80_000, applied_financing: 40_000 },
          offer_details: null,
        },
        {
          id: "inv-2",
          contract_id: "con-1",
          status: "SUBMITTED",
          details: { value: 40_000, applied_financing: 20_000 },
          offer_details: null,
        },
      ],
    });

    const overlaid = await overlayReadCapacityOnApplicationContract(db, {
      id: "app-draw",
      financing_structure: { structure_type: "existing_contract" },
      contract: unmarkedFacility,
    });
    const details = overlaid.contract?.contract_details as Record<string, unknown>;
    expect(details.available_facility).toBe(40_000);
    expect(details.pending_facility).toBe(60_000);
    expect(details.lifetime_used).toBe(120_000);
    expect(overlaid.contract?.facilityFeeUpfrontAmount).toBe(0);
    expect(overlaid.contract?.facilityFeeUpfrontOutstanding).toBe(0);
  });

  it("wires issuer application and contract reads through the live overlay", () => {
    const applicationService = fs.readFileSync(
      path.join(__dirname, "../modules/applications/service.ts"),
      "utf8"
    );
    const contractService = fs.readFileSync(
      path.join(__dirname, "../modules/contracts/service.ts"),
      "utf8"
    );
    expect(applicationService).toContain("overlayReadCapacityOnApplicationContract");
    expect(applicationService).toContain("overlayReadCapacityOnApplications");
    expect(contractService).toContain("overlayReadCapacityOnContracts");
    expect(contractService).not.toContain("overlayStoredCapacityOnContractDetails");
  });

  it("wires admin contract list and detail through the live overlay", () => {
    const adminRepository = fs.readFileSync(
      path.join(__dirname, "../modules/admin/repository.ts"),
      "utf8"
    );
    expect(adminRepository).toContain("overlayReadCapacityOnContracts");
    expect(adminRepository.match(/overlayReadCapacityOnContracts/g)?.length).toBeGreaterThanOrEqual(
      2
    );
  });
});
