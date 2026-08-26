import {
  isFacilityEnabled,
  resolveFacilityFeeBalance,
  resolveFacilityFeeUpfront,
  type FacilityFeeBalance,
} from "@cashsouk/types";
import { readFacilityFeeUpfrontOutstanding } from "@/lib/facility-fee-payment-ui";

export type IssuerFacilityGate = {
  enabled: boolean;
  disabledReason: string | null;
  canStartDrawdown: boolean;
  requiresFacilityFeePayment: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function resolveIssuerFacilityGate(input: {
  contractDetails?: unknown;
  facilityEnabled?: boolean;
  facilityDisabledReason?: string | null;
  contractStatus?: string | null;
  facilityFeeUpfrontOutstanding?: number | null;
}): IssuerFacilityGate {
  const details = asRecord(input.contractDetails) ?? {};
  const merged = {
    ...details,
    ...(input.facilityEnabled !== undefined ? { facility_enabled: input.facilityEnabled } : {}),
    ...(input.facilityDisabledReason != null
      ? { facility_disabled_reason: input.facilityDisabledReason }
      : {}),
  };
  const enabled = isFacilityEnabled(merged);
  const balance = resolveFacilityFeeBalance(merged);
  const disabledReason = enabled ? null : balance.disabledReason;
  const status = String(input.contractStatus ?? "").toUpperCase();
  const outstanding =
    input.facilityFeeUpfrontOutstanding != null
      ? readFacilityFeeUpfrontOutstanding(input.facilityFeeUpfrontOutstanding)
      : resolveFacilityFeeUpfront(merged).outstanding;
  const requiresFacilityFeePayment = outstanding > 0;
  return {
    enabled,
    disabledReason,
    requiresFacilityFeePayment,
    canStartDrawdown: enabled && status === "APPROVED" && !requiresFacilityFeePayment,
  };
}

export function resolveIssuerFacilityFeeBalance(input: {
  contractDetails?: unknown;
  approvedFacilityAmount?: unknown;
  facilityFeeCapAmount?: unknown;
  facilityFeePaidAmount?: unknown;
  facilityFeeWaived?: boolean;
}): FacilityFeeBalance {
  const details = asRecord(input.contractDetails) ?? {};
  return resolveFacilityFeeBalance({
    ...details,
    ...(input.approvedFacilityAmount != null ? { approved_facility: input.approvedFacilityAmount } : {}),
    ...(input.facilityFeeCapAmount != null
      ? { facility_fee_total_amount: input.facilityFeeCapAmount }
      : {}),
    ...(input.facilityFeePaidAmount != null
      ? { facility_fee_paid_amount: input.facilityFeePaidAmount }
      : {}),
    ...(input.facilityFeeWaived !== undefined ? { facility_fee_waived: input.facilityFeeWaived } : {}),
  });
}
