import { AppError } from "./http/error-handler";
import {
  assertCapacityWrite,
  assertFacilityBelowContractValue,
  assertProposedCapacitySnapshot,
  CONTRACT_LIFETIME_EXCEEDED,
  FACILITY_CAPACITY_EXCEEDED,
  FACILITY_MUST_BE_BELOW_CONTRACT_VALUE,
} from "./contract-capacity-errors";
import { emptyCapacitySnapshot, type ContractCapacitySnapshot } from "./contract-facility";

function snapshot(partial: Partial<ContractCapacitySnapshot>): ContractCapacitySnapshot {
  return { ...emptyCapacitySnapshot(), ...partial };
}

describe("assertFacilityBelowContractValue", () => {
  it("allows requested and approved amounts strictly below contract value", () => {
    expect(() =>
      assertFacilityBelowContractValue({
        contractValue: 1_000_000,
        requestedFacility: 400_000,
        approvedFacility: 350_000,
      })
    ).not.toThrow();
  });

  it("rejects requested or approved facility equal to contract value", () => {
    try {
      assertFacilityBelowContractValue({
        contractValue: 100_000,
        requestedFacility: 100_000,
        approvedFacility: 0,
        contractId: "c1",
      });
      throw new Error("expected AppError");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe(FACILITY_MUST_BE_BELOW_CONTRACT_VALUE);
      expect(appError.statusCode).toBe(422);
      expect(appError.details).toMatchObject({
        contractValue: 100_000,
        requestedFacility: 100_000,
        contractId: "c1",
      });
    }
  });
});

describe("assertCapacityWrite", () => {
  it("preserves an existing over-limit snapshot that does not increase occupancy", () => {
    const previous = snapshot({
      approvedFacility: 100_000,
      utilizedFacility: 205_190,
      availableFacility: 100_000 - 205_190,
      contractValue: 1_000_000,
      lifetimeCap: 1_000_000,
    });
    expect(() => assertCapacityWrite(previous, previous)).not.toThrow();
  });

  it("blocks a new write that deepens facility over-limit", () => {
    const previous = snapshot({
      approvedFacility: 100_000,
      utilizedFacility: 40_000,
      availableFacility: 60_000,
      contractValue: 1_000_000,
      lifetimeCap: 1_000_000,
    });
    const next = snapshot({
      approvedFacility: 100_000,
      utilizedFacility: 40_000,
      pendingFacility: 80_000,
      availableFacility: -20_000,
      contractValue: 1_000_000,
      lifetimeCap: 1_000_000,
    });
    try {
      assertCapacityWrite(previous, next, "c2");
      throw new Error("expected AppError");
    } catch (error) {
      expect(error).toMatchObject({ code: FACILITY_CAPACITY_EXCEEDED, statusCode: 422 });
    }
  });

  it("blocks a new write that deepens lifetime over-limit", () => {
    const previous = snapshot({
      approvedFacility: 100_000,
      availableFacility: 100_000,
      contractValue: 500_000,
      lifetimeCap: 500_000,
      lifetimeUsed: 520_000,
      lifetimeRemaining: -20_000,
    });
    const next = snapshot({
      ...previous,
      lifetimeUsed: 600_000,
      lifetimeRemaining: -100_000,
    });
    try {
      assertCapacityWrite(previous, next);
      throw new Error("expected AppError");
    } catch (error) {
      expect(error).toMatchObject({ code: CONTRACT_LIFETIME_EXCEEDED, statusCode: 422 });
    }
  });

  it("allows an amendment self-credit that reduces occupancy while still over-limit", () => {
    const previous = snapshot({
      approvedFacility: 100_000,
      pendingFacility: 130_000,
      availableFacility: -30_000,
      contractValue: 1_000_000,
      lifetimeCap: 1_000_000,
      lifetimeUsed: 200_000,
      lifetimeRemaining: 800_000,
    });
    const next = snapshot({
      ...previous,
      pendingFacility: 110_000,
      availableFacility: -10_000,
    });
    expect(() => assertCapacityWrite(previous, next)).not.toThrow();
  });

  it("skips revolving occupancy when the approved line is not in force", () => {
    const previous = snapshot({
      contractValue: 1_000_000,
      lifetimeCap: 1_000_000,
    });
    const next = snapshot({
      pendingFacility: 80_000,
      availableFacility: -80_000,
      contractValue: 1_000_000,
      lifetimeCap: 1_000_000,
      lifetimeUsed: 200_000,
      lifetimeRemaining: 800_000,
    });
    expect(() => assertCapacityWrite(previous, next)).not.toThrow();
  });

  it("skips lifetime when the contract has no face-value cap", () => {
    const previous = snapshot({
      approvedFacility: 100_000,
      availableFacility: 100_000,
    });
    const next = snapshot({
      ...previous,
      lifetimeUsed: 50_000,
      lifetimeRemaining: -50_000,
    });
    expect(() => assertCapacityWrite(previous, next)).not.toThrow();
  });

  it("treats a proposed snapshot with no previous as a new write", () => {
    try {
      assertProposedCapacitySnapshot(
        snapshot({
          approvedFacility: 100_000,
          pendingFacility: 150_000,
          availableFacility: -50_000,
          contractValue: 1_000_000,
          lifetimeCap: 1_000_000,
        })
      );
      throw new Error("expected AppError");
    } catch (error) {
      expect(error).toMatchObject({ code: FACILITY_CAPACITY_EXCEEDED, statusCode: 422 });
    }
  });
});
