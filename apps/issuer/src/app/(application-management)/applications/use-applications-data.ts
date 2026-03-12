/**
 * Applications data hook.
 *
 * WHAT IT DOES:
 * 1. Fetches applications (mock from data.ts, or API via useOrganizationApplications)
 * 2. Prepares each for display: API returns nested objects (contract, invoices, offer_details).
 *    We flatten them, add cardStatus (badge + buttons), extract document keys.
 * 3. Hides archived apps
 * 4. Sorts by status (rejected first, draft last), then by date
 *
 * The "prepare for display" step converts API shape to what the page needs. API uses snake_case,
 * nested relations; page needs flat camelCase, one status per card, invoice rows ready for table.
 */

import { useMemo } from "react";
import { useOrganization } from "@cashsouk/config";
import { useOrganizationApplications } from "@/hooks/use-applications";
import { USE_MOCK_DATA, mockApplications } from "./data";
import { getCardStatus, APPLICATION_STATUS_PRIORITY, type NormalizedApplication, type NormalizedInvoice } from "./status";

interface ApiContract {
  id?: string;
  status?: string;
  offer_details?: { expires_at?: string | null; offered_facility?: number } | null;
  contract_details?: Record<string, unknown> | null;
  customer_details?: Record<string, unknown> | null;
}

interface ApiInvoice {
  id: string;
  status?: string;
  offer_details?: Record<string, unknown> | null;
  details?: Record<string, unknown>;
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

function prepareInvoice(api: ApiInvoice, contractStatus: string | null): NormalizedInvoice {
  const details = (api.details ?? {}) as Record<string, unknown>;
  const doc = details.document as { s3_key?: string; file_name?: string } | undefined;
  const documentS3Key = doc?.s3_key ? String(doc.s3_key) : null;
  const documentName = String(doc?.file_name ?? details.document_name ?? details.document ?? "—");

  const offerStatus = api.status === "OFFER_SENT" && api.offer_details ? "Offer received" : null;
  const canReviewOffer = offerStatus === "Offer received" && (contractStatus === "APPROVED" || !contractStatus);

  let financingOffered = "—";
  let profitRate = "—";
  if (api.offer_details && offerStatus) {
    const od = api.offer_details as any;
    if (typeof od.offered_amount === "number") financingOffered = `RM ${od.offered_amount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;
    if (typeof od.offered_profit_rate_percent === "number") profitRate = `${od.offered_profit_rate_percent}%`;
  }

  return {
    id: api.id,
    number: String(details.invoice_number ?? details.number ?? "—"),
    maturityDate: details.maturity_date ? String(details.maturity_date) : null,
    value: typeof details.value === "number" ? details.value : typeof details.invoice_value === "number" ? details.invoice_value : null,
    appliedFinancing: typeof details.applied_financing === "number" ? details.applied_financing : typeof details.financing_amount === "number" ? details.financing_amount : null,
    document: documentName,
    documentS3Key,
    financingOffered,
    profitRate,
    status: api.status ?? "DRAFT",
    offerStatus,
    canReviewOffer,
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
  let facilityApplied: number | null = null;
  if (contractDetails.contract_value != null) contractValue = Number(contractDetails.contract_value);
  else if (contractDetails.value != null) contractValue = Number(contractDetails.value);
  if (contractDetails.facility_applied != null) facilityApplied = Number(contractDetails.facility_applied);
  else if (contractDetails.financing_amount != null) facilityApplied = Number(contractDetails.financing_amount);

  let approvedFacility = "N/A";
  if (contract?.offer_details && (contract.offer_details as any).offered_facility != null) {
    approvedFacility = `RM ${Number((contract.offer_details as any).offered_facility).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;
  } else {
    const ras = (api as any).review_and_submit as Record<string, unknown> | undefined;
    if (ras?.approved_facility != null) approvedFacility = String(ras.approved_facility);
  }

  const created = api.created_at ? new Date(api.created_at) : new Date();
  const updated = api.updated_at ? new Date(api.updated_at) : created;
  const submittedAt = (api as any).submitted_at != null ? String((api as any).submitted_at) : null;

  const contractId = (contract as ApiContract & { id?: string })?.id ?? (api as any).contract_id ?? null;
  const issuerOrganizationId = (api as any).issuer_organization_id as string | undefined;

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
    invoices: invoices.map((inv) => prepareInvoice(inv, contractStatus)),
    contractStatus,
    issuerOrganizationId,
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

export function useApplicationsData(): {
  applications: NormalizedApplication[];
  isLoading: boolean;
  error: Error | null;
} {
  const { activeOrganization } = useOrganization();
  const { data: apiApplications = [], isLoading, error } = useOrganizationApplications(
    USE_MOCK_DATA ? undefined : activeOrganization?.id
  );

  const applications = useMemo(() => {
    let list: NormalizedApplication[];
    if (USE_MOCK_DATA) {
      list = mockApplications;
    } else {
      list = (apiApplications as any[]).map((app) => prepareApplication(app));
    }
    const visible = list.filter((a) => a.status !== "archived");
    return sort(visible);
  }, [USE_MOCK_DATA, apiApplications]);

  return {
    applications,
    isLoading: USE_MOCK_DATA ? false : isLoading,
    error: error ?? null,
  };
}
