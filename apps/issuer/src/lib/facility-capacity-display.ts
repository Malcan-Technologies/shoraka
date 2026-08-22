import {
  CONTRACT_ALLOCATION_LABEL,
  CREDIT_FACILITY_LABEL,
  LEFT_ON_CONTRACT_LABEL,
  LEFT_TO_DRAW_LABEL,
} from "@cashsouk/types";

export type FacilityDisplayMetrics = {
  approved: number | null;
  utilized: number | null;
  pending: number | null;
  repaid: number | null;
  available: number | null;
  lifetimeCap: number | null;
  lifetimeUsed: number | null;
  lifetimeRemaining: number | null;
  contractValue: number | null;
  occupied: number | null;
};

export function parseFacilityDisplayAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function resolveFacilityDisplayMetrics(row: {
  approvedFacilityAmount?: string | null;
  utilizedFacilityAmount?: string | null;
  availableFacilityAmount?: string | null;
  pendingFacilityAmount?: string | null;
  repaidFacilityAmount?: string | null;
  lifetimeCapAmount?: string | null;
  lifetimeUsedAmount?: string | null;
  lifetimeRemainingAmount?: string | null;
  contractValueAmount?: string | null;
}): FacilityDisplayMetrics {
  const approved = parseFacilityDisplayAmount(row.approvedFacilityAmount);
  const utilized = parseFacilityDisplayAmount(row.utilizedFacilityAmount);
  const pending = parseFacilityDisplayAmount(row.pendingFacilityAmount);
  const available = parseFacilityDisplayAmount(row.availableFacilityAmount);
  const occupied = utilized != null || pending != null ? (utilized ?? 0) + (pending ?? 0) : null;
  return {
    approved,
    utilized,
    pending,
    repaid: parseFacilityDisplayAmount(row.repaidFacilityAmount),
    available,
    lifetimeCap: parseFacilityDisplayAmount(row.lifetimeCapAmount),
    lifetimeUsed: parseFacilityDisplayAmount(row.lifetimeUsedAmount),
    lifetimeRemaining: parseFacilityDisplayAmount(row.lifetimeRemainingAmount),
    contractValue: parseFacilityDisplayAmount(row.contractValueAmount),
    occupied,
  };
}

export function compactReservedLine(
  pending: number | null,
  formatMoney: (value: unknown) => string
): string | null {
  if (pending == null || pending <= 0) return null;
  return `${formatMoney(pending)} reserved`;
}

export function compactLifetimeLine(
  metrics: Pick<FacilityDisplayMetrics, "lifetimeRemaining" | "lifetimeCap">,
  formatMoney: (value: unknown) => string
): string | null {
  if (metrics.lifetimeRemaining == null && metrics.lifetimeCap == null) return null;
  if (metrics.lifetimeCap == null) {
    return `${LEFT_ON_CONTRACT_LABEL}: ${formatMoney(metrics.lifetimeRemaining)}`;
  }
  return `${LEFT_ON_CONTRACT_LABEL}: ${formatMoney(metrics.lifetimeRemaining)} of ${formatMoney(metrics.lifetimeCap)}`;
}

export function creditFacilityMeterLabel(input: {
  utilized: number;
  reserved: number;
  approved: number;
  available: number;
}): string {
  return `${CREDIT_FACILITY_LABEL}: ${input.utilized} utilised, ${input.reserved} reserved, ${input.available} ${LEFT_TO_DRAW_LABEL.toLowerCase()} of ${input.approved} approved. Repayment frees credit.`;
}

export function shouldShowFacilityImpact(contractId?: string | null): boolean {
  return Boolean(contractId?.trim());
}

/** Clamp meter `aria-valuenow` to `[min, max]` when legacy usage exceeds the cap. */
export function clampMeterAriaNow(now: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!Number.isFinite(now)) return lo;
  return Math.min(hi, Math.max(lo, now));
}

export function contractAllocationMeterLabel(input: {
  used: number;
  remaining: number;
  cap: number;
}): string {
  return `${CONTRACT_ALLOCATION_LABEL}: ${input.used} used, ${input.remaining} ${LEFT_ON_CONTRACT_LABEL.toLowerCase()} of ${input.cap} contract value. Settled invoices still use contract allocation.`;
}
