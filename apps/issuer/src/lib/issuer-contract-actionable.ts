import {
  shouldShowIssuerReviewOfferCta,
} from "@/lib/offer-utils";
import {
  asContractForModal,
  type IssuerDashboardContract,
} from "@/types/issuer-dashboard";

export function isFacilityAmendmentRequested(status: string | null | undefined): boolean {
  return String(status ?? "").toUpperCase() === "AMENDMENT_REQUESTED";
}

/**
 * Facility-level issuer action only: offer review, or the contract itself is in amendment.
 * Invoice-only amendments on an already-approved line stay on Applications.
 */
export function isIssuerContractActionable(contract: IssuerDashboardContract): boolean {
  if (shouldShowIssuerReviewOfferCta(asContractForModal(contract.contractForModal))) return true;
  return isFacilityAmendmentRequested(contract.contractStatus);
}
