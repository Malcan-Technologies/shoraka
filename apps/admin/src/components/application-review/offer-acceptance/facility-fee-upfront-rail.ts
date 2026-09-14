import {
  parseFiniteNumber,
  resolveFacilityFeeBalance,
  resolveFacilityFeeUpfront,
} from "@cashsouk/types";

export type FacilityFeeUpfrontRail = {
  requested: number;
  outstanding: number;
  paidTowardUpfront: number;
  waived: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Admin rail visibility for the issuer's upfront gateway payment.
 * Uses the stamped contract amount after accept, else the offer collect amount.
 */
export function resolveFacilityFeeUpfrontRail(input: {
  contractDetails?: unknown;
  offerDetails?: unknown;
}): FacilityFeeUpfrontRail | null {
  const details = asRecord(input.contractDetails) ?? {};
  const offer = asRecord(input.offerDetails);
  const stamped = Math.max(0, parseFiniteNumber(details.facility_fee_upfront_amount) ?? 0);
  const collectFromOffer = Math.max(
    0,
    parseFiniteNumber(offer?.facility_fee_upfront_collect_amount) ?? 0
  );
  const requestedSeed = stamped > 0 ? stamped : collectFromOffer;
  if (requestedSeed <= 0) return null;

  const merged = {
    ...details,
    facility_fee_upfront_amount: stamped > 0 ? stamped : collectFromOffer,
  };
  const upfront = resolveFacilityFeeUpfront(merged);
  const balance = resolveFacilityFeeBalance(merged);
  const requested = upfront.upfrontAmount > 0 ? upfront.upfrontAmount : requestedSeed;
  if (requested <= 0) return null;

  return {
    requested,
    outstanding: balance.waived
      ? 0
      : upfront.upfrontAmount > 0
        ? upfront.outstanding
        : Math.max(0, requested - balance.paid),
    paidTowardUpfront: Math.min(balance.paid, requested),
    waived: balance.waived,
  };
}
