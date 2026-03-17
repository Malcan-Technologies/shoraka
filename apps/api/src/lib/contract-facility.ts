/**
 * Shared helpers for contract facility values (requested, offered, approved).
 * Single source of truth for resolving facility amounts from contract_details and offer_details.
 *
 * See docs/guides/application-flow/contract-offer-facility-flow.md for the full flow.
 */

export type ContractDetailsLike = Record<string, unknown> | null | undefined;
export type OfferDetailsLike = Record<string, unknown> | null | undefined;
export interface InvoiceForFacilityRefresh {
  status?: string | null;
  details?: Record<string, unknown> | null;
  offer_details?: Record<string, unknown> | null;
}

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

/**
 * Resolve the amount that counts toward utilized facility for an approved invoice.
 * Prefers admin offered_amount from offer_details; falls back to value * ratio from details.
 */
function resolveInvoiceUtilizedAmount(invoice: InvoiceForFacilityRefresh): number {
  const offer = invoice.offer_details;
  if (offer && typeof offer === "object") {
    const v = offer.offered_amount;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  const details = invoice.details;
  const value = typeof details?.value === "number" ? details.value : 0;
  const ratio =
    typeof details?.financing_ratio_percent === "number" ? details.financing_ratio_percent : 60;
  return value * (ratio / 100);
}

/**
 * Compute approved/utilized/available facility snapshot from current contract and invoice state.
 * Utilized facility is the sum of admin offered amounts for APPROVED invoices
 * (offer_details.offered_amount); falls back to value * ratio when offer_details is missing.
 */
export function computeContractFacilitySnapshot(
  contractStatus: string,
  contractDetails: ContractDetailsLike,
  invoices: InvoiceForFacilityRefresh[]
): { approvedFacility: number; utilizedFacility: number; availableFacility: number } {
  const approvedFacility = resolveApprovedFacilityForRefresh(contractStatus, contractDetails);
  const utilizedFacility = invoices
    .filter((invoice) => invoice.status === "APPROVED")
    .reduce((sum, invoice) => sum + resolveInvoiceUtilizedAmount(invoice), 0);
  return {
    approvedFacility,
    utilizedFacility,
    availableFacility: approvedFacility - utilizedFacility,
  };
}
