import { resolveApprovedFacilityForRefresh } from "../../lib/contract-facility";

function isPlainObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function contractDetailsForApprovedFacility(details: unknown): Record<string, unknown> | null {
  if (!isPlainObjectRecord(details)) return null;
  const raw = details.approved_facility;
  if (typeof raw === "number" && Number.isFinite(raw)) return details;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return details;
  return { ...details, approved_facility: parsed };
}

export function sumApprovedFacilityAmount(
  contracts: Array<{ status: string; contract_details: unknown }>
): number {
  return contracts.reduce((sum, contract) => {
    return (
      sum +
      resolveApprovedFacilityForRefresh(
        contract.status,
        contractDetailsForApprovedFacility(contract.contract_details)
      )
    );
  }, 0);
}
