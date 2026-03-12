/**
 * Shared helpers for contract facility values (requested, offered, approved).
 * Single source of truth for resolving facility amounts from contract_details and offer_details.
 *
 * See docs/guides/application-flow/contract-offer-facility-flow.md for the full flow.
 */

export type ContractDetailsLike = Record<string, unknown> | null | undefined;
export type OfferDetailsLike = Record<string, unknown> | null | undefined;

/** Field names used for requested facility across different UI/configs. Checked in order. */
const REQUESTED_FACILITY_KEYS = [
  "financing",
  "value",
  "facility_applied",
  "contract_value",
] as const;

/**
 * Resolve the requested facility amount from contract_details.
 * Used when sending offers (admin) and for display.
 */
export function resolveRequestedFacility(cd: ContractDetailsLike): number {
  if (!cd || typeof cd !== "object") return 0;
  for (const key of REQUESTED_FACILITY_KEYS) {
    const v = cd[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/**
 * Resolve approved facility for capacity calculations.
 * Only non-zero when contract is APPROVED and approved_facility was set from issuer-accepted offer.
 * Otherwise 0 (SUBMITTED, OFFER_SENT, REJECTED, DRAFT).
 */
export function resolveApprovedFacilityForRefresh(
  contractStatus: string,
  cd: ContractDetailsLike
): number {
  if (
    contractStatus === "APPROVED" &&
    typeof cd?.approved_facility === "number" &&
    (cd.approved_facility as number) > 0
  ) {
    return cd.approved_facility as number;
  }
  return 0;
}

/**
 * Resolve offered facility from offer_details.
 */
export function resolveOfferedFacility(offer: OfferDetailsLike): number {
  if (!offer || typeof offer !== "object") return 0;
  const v = offer.offered_facility;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}
