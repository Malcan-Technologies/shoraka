import type { AdminContractDetail } from "@cashsouk/types";

/**
 * Facility amounts arrive from two places: `approvedFacility` is a typed number
 * on the payload, while utilization only exists inside the `contractDetails`
 * JSON blob, where issuers may have stored "1,250,000" or "RM 1,250,000.00".
 */
export function parseFacilityAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export type ContractFacilityMetrics = {
  approved: number;
  utilized: number;
  /** Never negative: an over-utilized facility has nothing left to draw. */
  available: number;
  /** `null` when there is no approved facility to measure utilization against. */
  utilizationPercent: number | null;
};

export function getContractUtilizationProgressClass(
  percent: number | null,
  hasFacility: boolean
) {
  if (!hasFacility || percent == null) return "bg-muted";
  if (percent > 100) return "bg-muted [&>div]:bg-status-rejected-text";
  if (percent >= 100) return "bg-muted [&>div]:bg-status-success-text";
  return "[&>div]:bg-status-submitted-text";
}

export function getContractUtilizationAccentClass(
  percent: number | null,
  hasFacility: boolean
) {
  if (!hasFacility || percent == null) return undefined;
  if (percent > 100) return "text-status-rejected-text";
  if (percent >= 100) return "text-status-success-text";
  return "text-status-submitted-text";
}

export function formatContractFacilityNoteCount(noteCount: number): string {
  if (noteCount <= 0) return "No notes have used this line of credit";
  if (noteCount === 1) return "1 note has used this line of credit";
  return `${noteCount} notes have used this line of credit`;
}

type ContractFacilityFields = Pick<AdminContractDetail, "approvedFacility" | "contractDetails">;

/**
 * Header metrics for the contract detail page. Same JSON source as the
 * contracts list utilization column, so both surfaces agree.
 */
export function resolveContractFacilityMetrics(
  contract: ContractFacilityFields
): ContractFacilityMetrics {
  const approved = parseFacilityAmount(contract.approvedFacility) ?? 0;
  const utilized = parseFacilityAmount(contract.contractDetails?.utilized_facility) ?? 0;

  return {
    approved,
    utilized,
    available: Math.max(0, approved - utilized),
    utilizationPercent: approved > 0 ? (utilized / approved) * 100 : null,
  };
}
