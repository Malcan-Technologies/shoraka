/**
 * Maps offer_acceptance phase + financing structure → application.status overlay.
 * See docs/guides/application-flow/offer-flow-polish-roadmap.md §3.3
 */

import {
  ApplicationStatus,
  type OfferAcceptanceStatus,
  getOfferAcceptanceFromOfferDetails,
} from "@cashsouk/types";

const OFFERABLE_OR_RESOLVED_INVOICE_STATUSES = new Set([
  "OFFER_SENT",
  "OFFER_EXPIRED",
  "APPROVED",
  "WITHDRAWN",
  "REJECTED",
]);

export function isExistingContractFinancing(
  financingStructure?: { structure_type?: string } | null
): boolean {
  return financingStructure?.structure_type === "existing_contract";
}

/** Application statuses that imply a new-contract offer ceremony (not valid for existing_contract). */
export const CONTRACT_OFFER_CEREMONY_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.CONTRACT_PENDING,
  ApplicationStatus.CONTRACT_SENT,
  ApplicationStatus.CONTRACT_ACCEPTED,
  ApplicationStatus.SIGNING_PENDING,
  ApplicationStatus.CONTRACT_SIGNED,
  ApplicationStatus.INVOICE_ACCEPTED,
];

export function resolveApplicationStatusAfterOfferAcceptanceSubmit(
  isInvoiceOnly: boolean,
  nextOfferAcceptanceStatus: OfferAcceptanceStatus
): ApplicationStatus {
  if (nextOfferAcceptanceStatus === "APPROVED_FOR_SIGNING") {
    return ApplicationStatus.SIGNING_PENDING;
  }
  return isInvoiceOnly
    ? ApplicationStatus.INVOICE_ACCEPTED
    : ApplicationStatus.CONTRACT_ACCEPTED;
}

/**
 * Returns application status for a phased offer, or null when phase does not drive status.
 */
export function resolveApplicationStatusFromOfferAcceptancePhase(
  isInvoiceOnly: boolean,
  offerAcceptanceStatus: OfferAcceptanceStatus | null | undefined,
  options?: {
    entityApproved?: boolean;
  }
): ApplicationStatus | null {
  if (!offerAcceptanceStatus) return null;

  switch (offerAcceptanceStatus) {
    case "PENDING_ISSUER":
      return isInvoiceOnly
        ? ApplicationStatus.INVOICES_SENT
        : ApplicationStatus.CONTRACT_SENT;
    case "PENDING_ADMIN_REVIEW":
    case "CHANGES_REQUESTED":
      return isInvoiceOnly
        ? ApplicationStatus.INVOICE_ACCEPTED
        : ApplicationStatus.CONTRACT_ACCEPTED;
    case "APPROVED_FOR_SIGNING":
    case "SIGNING_IN_PROGRESS":
      return ApplicationStatus.SIGNING_PENDING;
    case "COMPLETED":
      if (options?.entityApproved) {
        return isInvoiceOnly
          ? ApplicationStatus.INVOICE_SIGNED
          : ApplicationStatus.CONTRACT_SIGNED;
      }
      return ApplicationStatus.SIGNING_PENDING;
    default:
      return null;
  }
}

export function resolveApplicationStatusAfterCommercialAccept(input: {
  isInvoiceOnly: boolean;
  hasOfferAcceptance: boolean;
  action: "accept" | "reject";
  isContractPath: boolean;
}): ApplicationStatus | null {
  if (input.action !== "accept" || !input.hasOfferAcceptance) return null;
  if (input.isContractPath) return ApplicationStatus.CONTRACT_SIGNED;
  if (input.isInvoiceOnly) return ApplicationStatus.INVOICE_SIGNED;
  return null;
}

/**
 * Invoice-centric stage status (existing_contract and invoice-only fallbacks).
 * Skips contract-offer ceremony stages — contract was pre-approved or absent.
 */
export function resolveInvoiceCentricApplicationStatus(input: {
  invoiceStatuses: string[];
  isInvoiceTabUnlocked: boolean;
  isInvoiceOnly: boolean;
  offerAcceptanceStatus?: OfferAcceptanceStatus | null;
  entityApproved?: boolean;
}): ApplicationStatus {
  const {
    invoiceStatuses,
    isInvoiceTabUnlocked,
    isInvoiceOnly,
    offerAcceptanceStatus,
    entityApproved,
  } = input;

  const allOfferableOrResolved =
    invoiceStatuses.length > 0 &&
    invoiceStatuses.every((status) => OFFERABLE_OR_RESOLVED_INVOICE_STATUSES.has(status));

  if (allOfferableOrResolved) {
    if (isInvoiceOnly && offerAcceptanceStatus) {
      const phaseStatus = resolveApplicationStatusFromOfferAcceptancePhase(
        true,
        offerAcceptanceStatus,
        { entityApproved }
      );
      if (phaseStatus && phaseStatus !== ApplicationStatus.INVOICES_SENT) {
        return phaseStatus;
      }
    }
    if (
      invoiceStatuses.some((status) => status === "OFFER_EXPIRED") &&
      !invoiceStatuses.some((status) => status === "OFFER_SENT")
    ) {
      return ApplicationStatus.OFFER_EXPIRED;
    }
    return ApplicationStatus.INVOICES_SENT;
  }
  if (!isInvoiceTabUnlocked) return ApplicationStatus.UNDER_REVIEW;
  return ApplicationStatus.INVOICE_PENDING;
}

/** Primary offer acceptance status from contract (contract path) or standalone invoice (invoice-only). */
export function extractPrimaryOfferAcceptanceStatus(application: {
  financing_structure?: { structure_type?: string } | null;
  contract?: { offer_details?: unknown } | null;
  invoices?: Array<{
    contract_id?: string | null;
    offer_details?: unknown;
  }>;
}): OfferAcceptanceStatus | null {
  if (isExistingContractFinancing(application.financing_structure)) {
    return null;
  }

  const isInvoiceOnly =
    application.financing_structure?.structure_type === "invoice_only";

  if (!isInvoiceOnly && application.contract?.offer_details) {
    return getOfferAcceptanceFromOfferDetails(
      application.contract.offer_details as Record<string, unknown>
    )?.status ?? null;
  }

  const standalone = (application.invoices ?? []).find((inv) => !inv.contract_id);
  if (standalone?.offer_details) {
    return getOfferAcceptanceFromOfferDetails(
      standalone.offer_details as Record<string, unknown>
    )?.status ?? null;
  }

  return null;
}
