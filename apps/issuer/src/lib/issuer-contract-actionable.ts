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
 * Contract AMENDMENT_REQUESTED is set while CashSouk drafts and stays after the issuer resubmits.
 * Only the application status (surfaced as actionRequiredApplicationIds) says the issuer must act.
 */
export function isFacilityAmendmentSentToIssuer(contract: IssuerDashboardContract): boolean {
  return (
    isFacilityAmendmentRequested(contract.contractStatus) &&
    (contract.actionRequiredApplicationIds ?? []).length > 0
  );
}

/**
 * Facility-level issuer action only: offer review, or the contract itself is in amendment.
 * Invoice-only amendments on an already-approved line stay on Applications.
 */
export function isIssuerContractActionable(contract: IssuerDashboardContract): boolean {
  if (shouldShowIssuerReviewOfferCta(asContractForModal(contract.contractForModal))) return true;
  if (isFacilityAmendmentSentToIssuer(contract)) return true;
  return Number(contract.facilityFeeUpfrontOutstanding ?? 0) > 0;
}
