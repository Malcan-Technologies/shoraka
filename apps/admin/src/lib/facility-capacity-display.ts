import {
  CONTRACT_ALLOCATION_LABEL,
  CREDIT_FACILITY_LABEL,
  LEFT_ON_CONTRACT_HELPER,
  LEFT_TO_DRAW_HELPER,
  REQUESTED_FACILITY_BELOW_CONTRACT_COPY,
  isRequestedFacilityAtOrAboveContractValue,
  isReservedCapacityInvoiceStatus,
  mapCapacityApiError,
  previewDualLimits,
  readCapacityErrorCode,
} from "@cashsouk/types";
import type { ContractFacilityMetrics } from "@/contracts/utils/contract-facility-metrics";

export const REMAINING_CREDIT_LABEL = "Remaining credit";
export const REMAINING_ALLOCATION_LABEL = "Remaining allocation";
export const CREDIT_FACILITY_HEADING = `${CREDIT_FACILITY_LABEL} (reusable after repayment)`;
export const CONTRACT_ALLOCATION_HEADING = `${CONTRACT_ALLOCATION_LABEL} (used once)`;
export const OVER_LIMIT_LABEL = "Over limit";
export const RESERVED_LABEL = "Reserved";

export const CREDIT_FACILITY_HELPER = LEFT_TO_DRAW_HELPER;
export const CONTRACT_ALLOCATION_HELPER = LEFT_ON_CONTRACT_HELPER;

export const OFFERED_FACILITY_BELOW_CONTRACT_COPY =
  "Offered financing must be less than the contract value.";

export const OVER_LIMIT_OFFERS_BLOCKED_COPY =
  "This facility is over limit. New offers are blocked until occupancy is within both limits.";

export function creditFacilityMeterLabel(input: {
  utilized: number;
  reserved: number;
  approved: number;
  available: number;
}): string {
  return `${CREDIT_FACILITY_LABEL}: ${input.utilized} utilised, ${input.reserved} reserved, ${input.available} remaining credit of ${input.approved} approved. Repayment frees credit.`;
}

export function contractAllocationMeterLabel(input: {
  used: number;
  remaining: number;
  cap: number;
}): string {
  return `${CONTRACT_ALLOCATION_LABEL}: ${input.used} used, ${input.remaining} remaining allocation of ${input.cap} contract value. Settled invoices still use contract allocation.`;
}

export function compactReservedLine(
  pending: number,
  formatMoney: (value: number) => string
): string | null {
  if (pending <= 0) return null;
  return `${formatMoney(pending)} reserved`;
}

export function compactRemainingAllocationLine(
  metrics: Pick<ContractFacilityMetrics, "lifetimeRemaining" | "lifetimeCap">,
  formatMoney: (value: number) => string
): string | null {
  if (metrics.lifetimeCap <= 0 && metrics.lifetimeRemaining === 0) return null;
  if (metrics.lifetimeCap <= 0) {
    return `${REMAINING_ALLOCATION_LABEL}: ${formatMoney(metrics.lifetimeRemaining)}`;
  }
  return `${REMAINING_ALLOCATION_LABEL}: ${formatMoney(metrics.lifetimeRemaining)} of ${formatMoney(metrics.lifetimeCap)}`;
}

export function overLimitStateLabel(
  metrics: Pick<ContractFacilityMetrics, "isOverLimit">
): string | null {
  return metrics.isOverLimit ? OVER_LIMIT_LABEL : null;
}

export function resolveFacilityOfferBlockReason(input: {
  requestedFacility: number;
  offeredFacility: number;
  contractValue: number;
}): string | null {
  if (
    input.contractValue > 0 &&
    isRequestedFacilityAtOrAboveContractValue(input.requestedFacility, input.contractValue)
  ) {
    return REQUESTED_FACILITY_BELOW_CONTRACT_COPY;
  }
  if (
    input.contractValue > 0 &&
    isRequestedFacilityAtOrAboveContractValue(input.offeredFacility, input.contractValue)
  ) {
    return OFFERED_FACILITY_BELOW_CONTRACT_COPY;
  }
  return null;
}

export type InvoiceOfferDisableReason =
  | "rejected"
  | "maturity"
  | "missing_amount"
  | "missing_risk"
  | "exceeds_credit"
  | "exceeds_allocation"
  | "over_limit"
  | null;

export function resolveInvoiceOfferDisable(input: {
  isAdminRejected?: boolean;
  sendOfferBlockedByMaturity?: boolean;
  offeredAmount: number | null;
  invoiceFace: number | null;
  hasRiskRating: boolean;
  remainingCredit?: number | null;
  remainingAllocation?: number | null;
  invoiceStatus?: string | null;
  addBackFinancing?: number | null;
  addBackFace?: number | null;
  facilityOverLimit?: boolean;
}): { disabled: boolean; reason: InvoiceOfferDisableReason; message: string | null } {
  if (input.isAdminRejected) {
    return {
      disabled: true,
      reason: "rejected",
      message:
        "This invoice was rejected. Use Action → Set to pending, then you can send an offer.",
    };
  }
  if (input.sendOfferBlockedByMaturity) {
    return {
      disabled: true,
      reason: "maturity",
      message: "Maturity date must meet the product minimum before an offer can be sent.",
    };
  }
  if (input.offeredAmount == null) {
    return {
      disabled: true,
      reason: "missing_amount",
      message: "Enter offered financing before sending.",
    };
  }
  if (!input.hasRiskRating) {
    return {
      disabled: true,
      reason: "missing_risk",
      message: "Select a risk rating before sending the offer.",
    };
  }

  const reserved = isReservedCapacityInvoiceStatus(input.invoiceStatus);
  const preview = previewDualLimits({
    availableFacility: input.remainingCredit,
    lifetimeRemaining: input.remainingAllocation,
    financingAmount: input.offeredAmount,
    invoiceFace: input.invoiceFace ?? 0,
    addBackFinancing: input.addBackFinancing ?? 0,
    addBackFace: input.addBackFace ?? 0,
  });

  if (input.facilityOverLimit && !reserved) {
    return {
      disabled: true,
      reason: "over_limit",
      message: OVER_LIMIT_OFFERS_BLOCKED_COPY,
    };
  }
  if (preview.exceedsFacility) {
    return {
      disabled: true,
      reason: "exceeds_credit",
      message: `Offered financing exceeds ${REMAINING_CREDIT_LABEL.toLowerCase()}. Reduce the offer. There is no override.`,
    };
  }
  if (preview.exceedsLifetime) {
    return {
      disabled: true,
      reason: "exceeds_allocation",
      message: `Invoice face exceeds ${REMAINING_ALLOCATION_LABEL.toLowerCase()}. Reduce the invoice value. There is no override.`,
    };
  }
  return { disabled: false, reason: null, message: null };
}

export function mapAdminCapacityActionError(
  error: unknown,
  fallback: string
): { message: string; shouldRefetch: boolean } {
  const mapped = mapCapacityApiError(error);
  const code = readCapacityErrorCode(error);
  const record =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          message?: unknown;
          error?: { code?: unknown; message?: unknown };
        })
      : null;
  const conflict = record?.code === "CONFLICT" || record?.error?.code === "CONFLICT";
  const serverMessage =
    (error instanceof Error && error.message.trim() ? error.message : null) ??
    (typeof record?.error?.message === "string" && record.error.message.trim()
      ? record.error.message
      : null) ??
    (typeof record?.message === "string" && record.message.trim() ? record.message : null);
  const message = mapped ?? serverMessage ?? fallback;
  return {
    message,
    shouldRefetch: Boolean(code || conflict),
  };
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
