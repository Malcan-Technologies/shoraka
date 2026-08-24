import { CAPACITY_SNAPSHOT_VERSION, CAPACITY_SNAPSHOT_VERSION_KEY } from "@cashsouk/types";
import {
  mapAdminContractCapacityDto,
  readInvoiceFaceAmount,
} from "./contract-capacity-dto";

describe("mapAdminContractCapacityDto", () => {
  it("prefers typed snapshot columns over stale JSON", () => {
    const dto = mapAdminContractCapacityDto({
      status: "APPROVED",
      approved_facility: 100_000,
      utilized_facility: 40_000,
      pending_facility: 15_000,
      available_facility: 45_000,
      lifetime_cap: 500_000,
      lifetime_used: 120_000,
      lifetime_remaining: 380_000,
      contract_details: {
        title: "Keep me",
        approved_facility: 1,
        available_facility: 99,
        lifetime_remaining: 1,
      },
    });

    expect(dto.approvedFacility).toBe(100_000);
    expect(dto.utilizedFacility).toBe(40_000);
    expect(dto.pendingFacility).toBe(15_000);
    expect(dto.availableFacility).toBe(45_000);
    expect(dto.lifetimeCap).toBe(500_000);
    expect(dto.lifetimeUsed).toBe(120_000);
    expect(dto.lifetimeRemaining).toBe(380_000);
    expect(dto.contractDetails.title).toBe("Keep me");
    expect(dto.contractDetails.available_facility).toBe(45_000);
  });

  it("falls back to JSON when typed columns are zero and preserves negative over-limit", () => {
    const dto = mapAdminContractCapacityDto({
      status: "APPROVED",
      approved_facility: 0,
      utilized_facility: 0,
      pending_facility: 0,
      available_facility: 0,
      lifetime_cap: 0,
      lifetime_used: 0,
      lifetime_remaining: 0,
      contract_details: {
        approved_facility: 80_000,
        utilized_facility: 90_000,
        pending_facility: 5_000,
        available_facility: -15_000,
        lifetime_cap: 200_000,
        lifetime_used: 210_000,
        lifetime_remaining: -10_000,
      },
    });

    expect(dto.approvedFacility).toBe(80_000);
    expect(dto.availableFacility).toBe(-15_000);
    expect(dto.lifetimeRemaining).toBe(-10_000);
    expect(dto.pendingFacility).toBe(5_000);
  });

  it("does not materialize pending=0 from unmarked typed zeros", () => {
    const dto = mapAdminContractCapacityDto({
      status: "APPROVED",
      approved_facility: 0,
      utilized_facility: 0,
      pending_facility: 0,
      available_facility: 0,
      lifetime_cap: 0,
      lifetime_used: 0,
      lifetime_remaining: 0,
      contract_details: {
        approved_facility: 80_000,
        available_facility: 80_000,
        value: 200_000,
      },
    });

    expect(dto.pendingFacility).toBe(0);
    expect(dto.availableFacility).toBe(80_000);
    expect(dto.contractDetails).not.toHaveProperty("pending_facility");
    expect(dto.contractDetails).not.toHaveProperty(CAPACITY_SNAPSHOT_VERSION_KEY);
  });

  it("keeps marked pending=0 and available exactly", () => {
    const dto = mapAdminContractCapacityDto({
      status: "APPROVED",
      approved_facility: 100_000,
      utilized_facility: 0,
      pending_facility: 0,
      available_facility: 100_000,
      lifetime_cap: 500_000,
      lifetime_used: 0,
      lifetime_remaining: 500_000,
      contract_details: {
        approved_facility: 1,
        pending_facility: 9,
        available_facility: 99,
        [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
      },
    });

    expect(dto.pendingFacility).toBe(0);
    expect(dto.availableFacility).toBe(100_000);
    expect(dto.contractDetails.pending_facility).toBe(0);
    expect(dto.contractDetails.available_facility).toBe(100_000);
  });

  it("does not revive an approved line after the offer is retracted", () => {
    const dto = mapAdminContractCapacityDto({
      status: "SUBMITTED",
      approved_facility: 0,
      contract_details: { approved_facility: 100_000, available_facility: 100_000 },
    });
    expect(dto.approvedFacility).toBe(0);
  });
});

describe("readInvoiceFaceAmount", () => {
  it("reads a finite invoice face and ignores missing values", () => {
    expect(readInvoiceFaceAmount({ value: "RM 12,500.00" })).toBe(12_500);
    expect(readInvoiceFaceAmount({ value: 0 })).toBe(0);
    expect(readInvoiceFaceAmount({ number: "INV-1" })).toBeNull();
    expect(readInvoiceFaceAmount(null)).toBeNull();
  });
});
