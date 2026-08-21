import { AppError } from "./http/error-handler";
import {
  addFacilityAmounts,
  compareFacilityAmounts,
  facilityAmountLessThan,
  type ContractCapacitySnapshot,
} from "./contract-facility";

export const FACILITY_CAPACITY_EXCEEDED = "FACILITY_CAPACITY_EXCEEDED";
export const CONTRACT_LIFETIME_EXCEEDED = "CONTRACT_LIFETIME_EXCEEDED";
export const FACILITY_MUST_BE_BELOW_CONTRACT_VALUE = "FACILITY_MUST_BE_BELOW_CONTRACT_VALUE";

export type FacilityCapacityExceededDetails = {
  approvedFacility: number;
  utilizedFacility: number;
  pendingFacility: number;
  availableFacility: number;
  occupiedFacility: number;
  previousOccupiedFacility?: number;
  contractId?: string;
};

export type ContractLifetimeExceededDetails = {
  lifetimeCap: number;
  lifetimeUsed: number;
  lifetimeRemaining: number;
  previousLifetimeUsed?: number;
  contractId?: string;
};

export type FacilityMustBeBelowContractValueDetails = {
  contractValue: number;
  requestedFacility: number;
  approvedFacility: number;
  contractId?: string;
};

export function facilityCapacityExceededError(
  details: FacilityCapacityExceededDetails
): AppError {
  return new AppError(
    422,
    FACILITY_CAPACITY_EXCEEDED,
    "This write would exceed remaining facility capacity.",
    details
  );
}

export function contractLifetimeExceededError(
  details: ContractLifetimeExceededDetails
): AppError {
  return new AppError(
    422,
    CONTRACT_LIFETIME_EXCEEDED,
    "This write would exceed the contract lifetime cap.",
    details
  );
}

export function facilityMustBeBelowContractValueError(
  details: FacilityMustBeBelowContractValueDetails
): AppError {
  return new AppError(
    422,
    FACILITY_MUST_BE_BELOW_CONTRACT_VALUE,
    "Requested and approved facility must be strictly less than contract value.",
    details
  );
}

/**
 * Both requested and approved facility must be strictly less than contract value.
 * Zero amounts are skipped so drafts without a line do not fail.
 */
export function assertFacilityBelowContractValue(input: {
  contractValue: number;
  requestedFacility: number;
  approvedFacility: number;
  contractId?: string;
}): void {
  const requestedTooHigh =
    input.requestedFacility > 0 &&
    !facilityAmountLessThan(input.requestedFacility, input.contractValue);
  const approvedTooHigh =
    input.approvedFacility > 0 &&
    !facilityAmountLessThan(input.approvedFacility, input.contractValue);
  if (!requestedTooHigh && !approvedTooHigh) return;
  throw facilityMustBeBelowContractValueError({
    contractValue: input.contractValue,
    requestedFacility: input.requestedFacility,
    approvedFacility: input.approvedFacility,
    contractId: input.contractId,
  });
}

function emptyWriteBaseline(next: ContractCapacitySnapshot): ContractCapacitySnapshot {
  return {
    ...next,
    utilizedFacility: 0,
    pendingFacility: 0,
    availableFacility: next.approvedFacility,
    repaidFacility: 0,
    lifetimeUsed: 0,
    lifetimeRemaining: next.lifetimeCap,
  };
}

/**
 * Block new/increased writes that deepen an over-limit. Existing over-limit snapshots pass.
 */
export function assertCapacityWrite(
  previous: ContractCapacitySnapshot,
  next: ContractCapacitySnapshot,
  contractId?: string
): void {
  const requestedIncreased =
    compareFacilityAmounts(next.requestedFacility, previous.requestedFacility) > 0;
  const approvedIncreased =
    compareFacilityAmounts(next.approvedFacility, previous.approvedFacility) > 0;
  if (requestedIncreased || approvedIncreased) {
    assertFacilityBelowContractValue({
      contractValue: next.contractValue,
      requestedFacility: next.requestedFacility,
      approvedFacility: next.approvedFacility,
      contractId,
    });
  }

  const previousOccupied = addFacilityAmounts(previous.utilizedFacility, previous.pendingFacility);
  const nextOccupied = addFacilityAmounts(next.utilizedFacility, next.pendingFacility);
  const lineInForce = compareFacilityAmounts(next.approvedFacility, 0) > 0;
  if (
    lineInForce &&
    compareFacilityAmounts(next.availableFacility, 0) < 0 &&
    compareFacilityAmounts(nextOccupied, previousOccupied) > 0
  ) {
    throw facilityCapacityExceededError({
      approvedFacility: next.approvedFacility,
      utilizedFacility: next.utilizedFacility,
      pendingFacility: next.pendingFacility,
      availableFacility: next.availableFacility,
      occupiedFacility: nextOccupied,
      previousOccupiedFacility: previousOccupied,
      contractId,
    });
  }

  if (
    compareFacilityAmounts(next.lifetimeCap, 0) > 0 &&
    compareFacilityAmounts(next.lifetimeRemaining, 0) < 0 &&
    compareFacilityAmounts(next.lifetimeUsed, previous.lifetimeUsed) > 0
  ) {
    throw contractLifetimeExceededError({
      lifetimeCap: next.lifetimeCap,
      lifetimeUsed: next.lifetimeUsed,
      lifetimeRemaining: next.lifetimeRemaining,
      previousLifetimeUsed: previous.lifetimeUsed,
      contractId,
    });
  }
}

export function assertProposedCapacitySnapshot(
  proposed: ContractCapacitySnapshot,
  previous?: ContractCapacitySnapshot,
  contractId?: string
): void {
  assertCapacityWrite(previous ?? emptyWriteBaseline(proposed), proposed, contractId);
}
