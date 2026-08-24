import {
  resolveApprovedFacilityForRefresh,
  parseFacilityJsonAmount,
} from "../../lib/contract-facility";
import {
  overlayStoredCapacityOnContractDetails,
  storedCapacityFromContract,
} from "../../lib/refresh-contract-facility";

export type AdminContractCapacitySource = {
  status: string;
  approved_facility?: unknown;
  utilized_facility?: unknown;
  pending_facility?: unknown;
  repaid_facility?: unknown;
  available_facility?: unknown;
  lifetime_cap?: unknown;
  lifetime_used?: unknown;
  lifetime_remaining?: unknown;
  contract_details?: unknown;
};

export type AdminContractCapacityDto = {
  approvedFacility: number;
  utilizedFacility: number;
  pendingFacility: number;
  availableFacility: number;
  lifetimeCap: number;
  lifetimeUsed: number;
  lifetimeRemaining: number;
  contractDetails: Record<string, unknown>;
};

function finiteAmount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function mapAdminContractCapacityDto(
  contract: AdminContractCapacitySource
): AdminContractCapacityDto {
  const overlaid = overlayStoredCapacityOnContractDetails(contract);
  const snapshot = storedCapacityFromContract(overlaid);
  const contractDetails =
    overlaid.contract_details &&
    typeof overlaid.contract_details === "object" &&
    !Array.isArray(overlaid.contract_details)
      ? (overlaid.contract_details as Record<string, unknown>)
      : {};
  const approved = resolveApprovedFacilityForRefresh(contract.status, contractDetails);
  return {
    approvedFacility: finiteAmount(approved),
    utilizedFacility: finiteAmount(snapshot.utilizedFacility),
    pendingFacility: finiteAmount(snapshot.pendingFacility),
    availableFacility: finiteAmount(snapshot.availableFacility),
    lifetimeCap: finiteAmount(snapshot.lifetimeCap),
    lifetimeUsed: finiteAmount(snapshot.lifetimeUsed),
    lifetimeRemaining: finiteAmount(snapshot.lifetimeRemaining),
    contractDetails,
  };
}

export function readInvoiceFaceAmount(details: unknown): number | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = parseFacilityJsonAmount((details as Record<string, unknown>).value);
  return value != null && Number.isFinite(value) ? value : null;
}
