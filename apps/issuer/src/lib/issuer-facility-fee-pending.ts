import { formatCurrency } from "@cashsouk/config";
import { shouldShowIssuerReviewOfferCta } from "@/lib/offer-utils";
import {
  asContractForModal,
  type IssuerDashboardContract,
} from "@/types/issuer-dashboard";
import { isFacilityAmendmentRequested } from "@/lib/issuer-contract-actionable";

function moneyNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function outstandingFacilityFeeAmount(contract: IssuerDashboardContract): number {
  const outstanding = Number(contract.facilityFeeUpfrontOutstanding ?? 0);
  return Number.isFinite(outstanding) ? Math.max(0, outstanding) : 0;
}

export function remainingFacilityFeeForDrawdowns(
  contract: IssuerDashboardContract
): number | null {
  const outstanding = outstandingFacilityFeeAmount(contract);
  let remaining = moneyNumber(contract.facilityFeeRemainingAmount);
  if (remaining == null) {
    const cap = moneyNumber(contract.facilityFeeCapAmount);
    const paid = moneyNumber(contract.facilityFeePaidAmount);
    if (cap == null || paid == null) return null;
    remaining = Math.max(0, cap - paid);
  }
  return Math.max(0, remaining - outstanding);
}

export function isIssuerContractFeeOnlyActionable(contract: IssuerDashboardContract): boolean {
  if (outstandingFacilityFeeAmount(contract) <= 0) return false;
  if (shouldShowIssuerReviewOfferCta(asContractForModal(contract.contractForModal))) return false;
  return !isFacilityAmendmentRequested(contract.contractStatus);
}

export function aggregateFacilityFeeBannerAmounts(
  contracts: readonly IssuerDashboardContract[]
): { outstanding: number; remainingForDrawdowns: number | null } {
  const withFee = contracts.filter((contract) => outstandingFacilityFeeAmount(contract) > 0);
  const outstanding = withFee.reduce(
    (sum, contract) => sum + outstandingFacilityFeeAmount(contract),
    0
  );
  let remainingSum = 0;
  let hasRemaining = false;
  for (const contract of withFee) {
    const remaining = remainingFacilityFeeForDrawdowns(contract);
    if (remaining == null) continue;
    remainingSum += remaining;
    hasRemaining = true;
  }
  return {
    outstanding,
    remainingForDrawdowns: hasRemaining ? remainingSum : null,
  };
}

/** Copy for the dashboard action banner when an upfront facility fee is due. */
export function facilityFeeBannerDescription(input: {
  outstanding: number;
  remainingForDrawdowns: number | null;
}): string | null {
  if (input.outstanding <= 0) return null;
  const dueNow = `${formatCurrency(input.outstanding)} is due now.`;
  if (input.remainingForDrawdowns == null) return dueNow;
  if (input.remainingForDrawdowns > 0) {
    return `${dueNow} ${formatCurrency(input.remainingForDrawdowns)} will be collected from later drawdowns.`;
  }
  return `${dueNow} No further facility fee will be collected from later drawdowns.`;
}
