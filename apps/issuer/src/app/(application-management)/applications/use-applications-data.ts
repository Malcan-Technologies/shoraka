/**
 * Applications data hook.
 *
 * WHAT IT DOES:
 * 1. Fetches applications from API (or uses debug mock when provided)
 * 2. Prepares each for display: API returns nested objects (contract, invoices, offer_details).
 *    We flatten them, add cardStatus (badge + buttons), extract document keys.
 * 3. Hides archived apps
 * 4. Sorts by status priority, then by updatedAt DESC
 *
 * Debug overrides (dev only): debugShowSkeleton forces loading state; debugMockApplications
 * replaces API data. Mock data is injected at UI layer only. API calls unchanged.
 */

import { useMemo } from "react";
import {
  useOrganization,
  formatCurrency,
  resolveOfferedAmount,
  resolveOfferedProfitRate,
  resolveRequestedInvoiceAmount,
  resolveApprovedFacility,
  resolveRequestedFacility,
} from "@cashsouk/config";
import { WithdrawReason } from "@cashsouk/types";
import { useOrganizationApplications } from "@/hooks/use-applications";
import { getCardStatus, APPLICATION_STATUS_PRIORITY, type NormalizedApplication, type NormalizedInvoice } from "./status";

export interface UseApplicationsDataOptions {
  debugShowSkeleton?: boolean;
  debugMockApplications?: NormalizedApplication[] | null;
}

interface ApiContract {
  id?: string;
  status?: string;
  withdraw_reason?: string | null;
  offer_details?: { expires_at?: string | null; offered_facility?: number } | null;
  contract_details?: Record<string, unknown> | null;
  customer_details?: Record<string, unknown> | null;
  offer_signing?: unknown;
}

interface ApiInvoice {
  id: string;
  status?: string;
  withdraw_reason?: string | null;
  offer_details?: { expires_at?: string | null } | Record<string, unknown> | null;
  details?: Record<string, unknown>;
  offer_signing?: unknown;
}

interface ApiApplication {
  id: string;
  status?: string;
  financing_structure?: { structure_type?: string } | null;
  created_at?: string;
  updated_at?: string;
  contract?: ApiContract | null;
  invoices?: ApiInvoice[];
}

function isSignedOfferLetterAvailable(offerSigning: unknown): boolean {
  if (!offerSigning || typeof offerSigning !== "object") return false;
  const o = offerSigning as Record<string, unknown>;
  return (
    o.status === "signed" &&
    typeof o.signed_offer_letter_s3_key === "string" &&
    o.signed_offer_letter_s3_key.length > 0
  );
}

function prepareInvoice(api: ApiInvoice, contractStatus: string | null, structureType: string | undefined): NormalizedInvoice {
  const details = (api.details ?? {}) as Record<string, unknown>;
  const doc = details.document as { s3_key?: string; file_name?: string } | undefined;
  const documentS3Key = doc?.s3_key ? String(doc.s3_key) : null;
  const documentName = String(doc?.file_name ?? details.document_name ?? details.document ?? "—");

  const offerStatus = api.status === "OFFER_SENT" && api.offer_details ? "Offer received" : null;
  const canReviewOffer = offerStatus === "Offer received" && (
    structureType === "invoice_only" ||
    contractStatus === "APPROVED" ||
    !contractStatus
  );

  const offeredAmount = resolveOfferedAmount(api.offer_details);
  const profitRateVal = resolveOfferedProfitRate(api.offer_details);
  const hasOffer = api.status === "OFFER_SENT" || api.status === "APPROVED";
  const financingOffered =
    hasOffer && offeredAmount > 0 ? formatCurrency(offeredAmount) : "—";
  const profitRate =
    hasOffer && profitRateVal != null && profitRateVal > 0 ? `${profitRateVal}%` : "—";

  const invoiceValue =
    typeof details.value === "number" ? details.value : typeof details.invoice_value === "number" ? details.invoice_value : null;
  const appliedFinancing = resolveRequestedInvoiceAmount(details);

  return {
    id: api.id,
    number: String(details.invoice_number ?? details.number ?? "—"),
    maturityDate: details.maturity_date ? String(details.maturity_date) : null,
    value: invoiceValue,
    appliedFinancing,
    document: documentName,
    documentS3Key,
    financingOffered,
    profitRate,
    status: api.status ?? "DRAFT",
    offerStatus,
    canReviewOffer,
    offer_details: api.offer_details ?? null,
    signedOfferLetterAvailable: isSignedOfferLetterAvailable(api.offer_signing),
  };
}

function prepareApplication(api: ApiApplication): NormalizedApplication {
  const contract = api.contract;
  const contractStatus = contract?.status ?? null;
  const invoices = api.invoices ?? [];

  const cardStatus = getCardStatus({
    applicationStatus: api.status ?? "DRAFT",
    contractStatus,
    invoiceStatuses: invoices.map((i) => i.status ?? "DRAFT"),
  });

  const structureType = (api.financing_structure as { structure_type?: string } | undefined)?.structure_type;
  let type: "Contract financing" | "Invoice financing" | "Generic" = "Generic";
  if (api.status === "DRAFT" && !structureType) type = "Generic";
  else if (structureType === "invoice_only") type = "Invoice financing";
  else if (structureType === "existing_contract" || structureType === "new_contract") type = "Contract financing";
  else type = contract ? "Contract financing" : "Invoice financing";

  const contractDetails = (contract?.contract_details ?? {}) as Record<string, unknown>;
  const customerDetails = (contract?.customer_details ?? {}) as Record<string, unknown>;
  const companyDetails = (api as any).company_details ?? {};
  const customer = String(customerDetails.customer_name ?? customerDetails.name ?? companyDetails.customer_name ?? companyDetails.company_name ?? "—") || "—";
  const contractTitle = (contractDetails.title ? String(contractDetails.title) : contractDetails.contract_title ? String(contractDetails.contract_title) : null) as string | null;

  let contractValue: number | null = null;
  const facilityAppliedVal = resolveRequestedFacility(contractDetails);
  const facilityApplied = facilityAppliedVal > 0 ? facilityAppliedVal : null;
  if (contractDetails.contract_value != null) contractValue = Number(contractDetails.contract_value);
  else if (contractDetails.value != null) contractValue = Number(contractDetails.value);

  let approvedFacility = "N/A";
  const approvedVal = resolveApprovedFacility(contractStatus ?? "", contractDetails);
  if (approvedVal > 0) {
    approvedFacility = formatCurrency(approvedVal);
  } else if (contractStatus === "APPROVED") {
    const ras = (api as any).review_and_submit as Record<string, unknown> | undefined;
    if (ras?.approved_facility != null) approvedFacility = formatCurrency(Number(ras.approved_facility));
  }

  const created = api.created_at ? new Date(api.created_at) : new Date();
  const updated = api.updated_at ? new Date(api.updated_at) : created;
  const submittedAt = (api as any).submitted_at != null ? String((api as any).submitted_at) : null;

  const contractId = (contract as ApiContract & { id?: string })?.id ?? (api as any).contract_id ?? null;
  const issuerOrganizationId = (api as any).issuer_organization_id as string | undefined;

  /** Withdraw reason: from contract or first withdrawn invoice. */
  let withdrawReason: WithdrawReason | undefined;
  const contractWithdraw = (contract as ApiContract)?.withdraw_reason;
  if (
    contractWithdraw === WithdrawReason.USER_CANCELLED ||
    contractWithdraw === WithdrawReason.OFFER_EXPIRED ||
    contractWithdraw === WithdrawReason.OFFER_REJECTED
  ) {
    withdrawReason = contractWithdraw as WithdrawReason;
  } else {
    const withdrawnInv = invoices.find((i) => (i.status ?? "").toUpperCase() === "WITHDRAWN");
    const invReason = (withdrawnInv as ApiInvoice)?.withdraw_reason;
    if (
      invReason === WithdrawReason.USER_CANCELLED ||
      invReason === WithdrawReason.OFFER_EXPIRED ||
      invReason === WithdrawReason.OFFER_REJECTED
    ) {
      withdrawReason = invReason as WithdrawReason;
    }
  }

  /** Offer expiry: from contract or first invoice with offer. */
  let expiresAt: string | null | undefined;
  const co = contract?.offer_details as { expires_at?: string | null } | undefined;
  if (co?.expires_at) expiresAt = String(co.expires_at);
  else {
    const invWithOffer = invoices.find((i) => i.status === "OFFER_SENT" && i.offer_details);
    const io = (invWithOffer?.offer_details ?? {}) as { expires_at?: string | null };
    if (io?.expires_at) expiresAt = String(io.expires_at);
  }

  const signedContractOfferLetterAvailable = isSignedOfferLetterAvailable(
    (contract as ApiContract | null)?.offer_signing
  );

  return {
    id: api.id,
    type,
    status: cardStatus.badgeKey,
    cardStatus,
    contractTitle,
    contractId: contractId ? String(contractId) : null,
    customer,
    applicationDate: created.toISOString().slice(0, 10),
    submittedAt,
    contractValue,
    facilityApplied,
    approvedFacility,
    updatedAt: updated.toISOString(),
    invoices: invoices.map((inv) => prepareInvoice(inv, contractStatus, structureType)),
    contractStatus,
    issuerOrganizationId,
    withdrawReason,
    expiresAt,
    signedContractOfferLetterAvailable,
  };
}

/* Sort: 1) by status priority, 2) by last updated (newest first). */
function sort(apps: NormalizedApplication[]): NormalizedApplication[] {
  return [...apps].sort((a, b) => {
    const pa = APPLICATION_STATUS_PRIORITY[a.status] ?? 999;
    const pb = APPLICATION_STATUS_PRIORITY[b.status] ?? 999;
    if (pa !== pb) return pa - pb;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function useApplicationsData(options?: UseApplicationsDataOptions): {
  applications: NormalizedApplication[];
  isLoading: boolean;
  error: Error | null;
} {
  const { debugShowSkeleton = false, debugMockApplications } = options ?? {};
  const { activeOrganization } = useOrganization();
  const { data: apiApplications = [], isLoading, error } = useOrganizationApplications(
    debugMockApplications ? undefined : activeOrganization?.id
  );

  const applications = useMemo(() => {
    if (debugShowSkeleton) {
      return [];
    }
    let list: NormalizedApplication[];
    if (debugMockApplications && debugMockApplications.length > 0) {
      list = debugMockApplications;
    } else {
      list = (apiApplications as any[]).map((app) => prepareApplication(app));
    }
    const visible = list.filter((a) => a.status !== "archived");
    return sort(visible);
  }, [debugShowSkeleton, debugMockApplications, apiApplications]);

  const isLoadingResolved = debugShowSkeleton || (debugMockApplications ? false : isLoading);

  return {
    applications,
    isLoading: isLoadingResolved,
    error: error ?? null,
  };
}
