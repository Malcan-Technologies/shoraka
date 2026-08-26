import { resolveFacilityFeeBalance, resolveFacilityFeeUpfront } from "@cashsouk/types";
import { AppError } from "./http/error-handler";

export type FacilityFeeUpfrontDto = {
  facilityFeeUpfrontAmount: number;
  facilityFeeUpfrontOutstanding: number;
};

export function facilityFeeUpfrontDto(details: unknown): FacilityFeeUpfrontDto {
  const { upfrontAmount, outstanding } = resolveFacilityFeeUpfront(details);
  return {
    facilityFeeUpfrontAmount: upfrontAmount,
    facilityFeeUpfrontOutstanding: outstanding,
  };
}

export function overlayFacilityFeeUpfrontDto<T extends { contract_details?: unknown }>(
  contract: T
): T & FacilityFeeUpfrontDto {
  return {
    ...contract,
    ...facilityFeeUpfrontDto(contract.contract_details),
  };
}

/**
 * Hard-block facility-linked invoice/drawdown work while upfront facility fee
 * remains unpaid. Waived or zero-outstanding contracts pass.
 */
export function assertFacilityFeeUpfrontSettled(contractDetails: unknown): void {
  const { upfrontAmount, outstanding } = resolveFacilityFeeUpfront(contractDetails);
  if (outstanding <= 0) return;
  const paidAmount = resolveFacilityFeeBalance(contractDetails).paid;
  throw new AppError(
    409,
    "FACILITY_FEE_UPFRONT_REQUIRED",
    "Pay the outstanding upfront facility fee before using this facility for invoice financing.",
    {
      outstanding,
      upfrontAmount,
      paidAmount,
    }
  );
}
