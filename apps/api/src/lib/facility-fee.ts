export type ProgressiveFacilityFeeInput = {
  approvedFacilityAmount: number;
  facilityFeeRatePercent: number;
  facilityFeePaidBefore: number;
  fundedAmountForDisbursement: number;
};

export type ProgressiveFacilityFeeOutput = {
  facilityFeeCap: number;
  rawFacilityFee: number;
  facilityFeePaidBefore: number;
  remainingFacilityFee: number;
  facilityFeeCharged: number;
};

/**
 * Progressive facility fee based on:
 * - total cap = approvedFacilityAmount * rate%
 * - each disbursement tries to charge disbursementAmount * rate%
 * - never exceed remainingFacilityFee
 *
 * Rounding policy: follow existing platform-fee behavior (plain number math),
 * and let Decimal/DB layer round where needed.
 */
export function computeProgressiveFacilityFee(
  input: ProgressiveFacilityFeeInput
): ProgressiveFacilityFeeOutput {
  const approvedFacilityAmount = Number.isFinite(input.approvedFacilityAmount)
    ? input.approvedFacilityAmount
    : 0;
  const facilityFeeRatePercent = Number.isFinite(input.facilityFeeRatePercent)
    ? input.facilityFeeRatePercent
    : 0;
  const facilityFeePaidBefore = Number.isFinite(input.facilityFeePaidBefore)
    ? input.facilityFeePaidBefore
    : 0;
  const fundedAmountForDisbursement = Number.isFinite(input.fundedAmountForDisbursement)
    ? input.fundedAmountForDisbursement
    : 0;

  const facilityFeeCap = approvedFacilityAmount * (facilityFeeRatePercent / 100);
  const rawFacilityFee = fundedAmountForDisbursement * (facilityFeeRatePercent / 100);

  const remainingFacilityFee = facilityFeeCap - facilityFeePaidBefore;
  const facilityFeeCharged = Math.max(
    0,
    Math.min(rawFacilityFee, Number.isFinite(remainingFacilityFee) ? remainingFacilityFee : 0)
  );

  return {
    facilityFeeCap,
    rawFacilityFee,
    facilityFeePaidBefore,
    remainingFacilityFee,
    facilityFeeCharged,
  };
}

