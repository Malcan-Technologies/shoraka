/**
 * Application adapter — converts backend API data into clean UI objects.
 * Never pass raw API responses to components. Always use these functions.
 */

import { getOfferStatus } from "@/lib/offer-utils";

/* ============================================================
   Types for API responses (what the backend returns)
   ============================================================ */

/** Raw contract from API (Prisma Contract with relations) */
interface ApiContract {
  id?: string;
  status?: string;
  offer_details?: {
    requested_facility?: number;
    offered_facility?: number;
    expires_at?: string | null;
    sent_at?: string;
    responded_at?: string | null;
    responded_by_user_id?: string | null;
    version?: number;
  } | null;
  contract_details?: Record<string, unknown> | null;
  customer_details?: Record<string, unknown> | null;
}

/** Raw invoice from API (Prisma Invoice) */
interface ApiInvoice {
  id: string;
  status?: string;
  offer_details?: {
    requested_amount?: number;
    offered_amount?: number;
    requested_ratio_percent?: number;
    offered_ratio_percent?: number;
    offered_profit_rate_percent?: number;
    expires_at?: string | null;
    sent_at?: string;
    responded_at?: string | null;
    responded_by_user_id?: string | null;
    version?: number;
  } | null;
  details?: Record<string, unknown>;
}

/** Raw application from API (Prisma Application with contract + invoices) */
interface ApiApplication {
  id: string;
  status?: string;
  financing_structure?: { structure_type?: string } | null;
  created_at?: string;
  updated_at?: string;
  contract?: ApiContract | null;
  invoices?: ApiInvoice[];
}

/* ============================================================
   Types for UI (what components receive)
   ============================================================ */

/** Normalized offer for display */
export interface NormalizedOffer {
  requestedAmount?: number;
  offeredAmount?: number;
  requestedFacility?: number;
  offeredFacility?: number;
  requestedRatioPercent?: number;
  offeredRatioPercent?: number;
  offeredProfitRatePercent?: number;
  expiresAt?: string | null;
  sentAt?: string;
  respondedAt?: string | null;
}

/** Normalized invoice for UI */
export interface NormalizedInvoice {
  id: string;
  number: string;
  maturityDate: string | null;
  value: number | null;
  appliedFinancing: number | null;
  document: string;
  financingOffered: string;
  profitRate: string;
  status: string;
  offerStatus: "Offer received" | "Offer expired" | null;
  /** Whether Review Offer button should be enabled (contract must be approved for invoice offers) */
  canReviewOffer: boolean;
}

/** Normalized application for UI */
export interface NormalizedApplication {
  id: string;
  type: "Contract financing" | "Invoice financing" | "Generic";
  status: string;
  badges: string[];
  /** True when contract or any invoice has offer expired */
  hasExpiredOffer: boolean;
  contractTitle: string | null;
  customer: string;
  applicationDate: string;
  contractValue: number | null;
  facilityApplied: number | null;
  approvedFacility: string;
  updatedAt: string;
  invoices: NormalizedInvoice[];
  /** Contract status (for invoice offer rule: must be APPROVED to review invoice offers) */
  contractStatus: string | null;
}

/* ============================================================
   normalizeOffer — convert API offer_details to UI shape
   ============================================================ */

export function normalizeOffer(
  apiOffer: ApiContract["offer_details"] | ApiInvoice["offer_details"]
): NormalizedOffer | null {
  if (!apiOffer) return null;

  /* Contract offer has facility fields; invoice offer has amount/ratio fields */
  const hasFacility =
    "requested_facility" in apiOffer || "offered_facility" in apiOffer;
  const hasAmount =
    "requested_amount" in apiOffer || "offered_amount" in apiOffer;

  return {
    requestedAmount: hasAmount ? (apiOffer as any).requested_amount : undefined,
    offeredAmount: hasAmount ? (apiOffer as any).offered_amount : undefined,
    requestedFacility: hasFacility
      ? (apiOffer as any).requested_facility
      : undefined,
    offeredFacility: hasFacility ? (apiOffer as any).offered_facility : undefined,
    requestedRatioPercent: hasAmount
      ? (apiOffer as any).requested_ratio_percent
      : undefined,
    offeredRatioPercent: hasAmount
      ? (apiOffer as any).offered_ratio_percent
      : undefined,
    offeredProfitRatePercent: hasAmount
      ? (apiOffer as any).offered_profit_rate_percent
      : undefined,
    expiresAt: apiOffer.expires_at ?? undefined,
    sentAt: apiOffer.sent_at,
    respondedAt: apiOffer.responded_at ?? undefined,
  };
}

/* ============================================================
   normalizeInvoice — convert API invoice to UI invoice
   ============================================================ */

export function normalizeInvoice(
  apiInvoice: ApiInvoice,
  contractStatus: string | null
): NormalizedInvoice {
  const details = (apiInvoice.details ?? {}) as Record<string, unknown>;
  const offerDetails = apiInvoice.offer_details;
  const offerStatus = getOfferStatus({
    status: apiInvoice.status,
    offer_details: offerDetails,
  });

  /* Invoice Review Offer is only enabled when contract is approved (or no contract) */
  const canReviewOffer =
    offerStatus === "Offer received" &&
    (contractStatus === "APPROVED" || !contractStatus);

  /* Format financing offered and profit rate from offer_details */
  let financingOffered = "—";
  let profitRate = "—";
  if (offerDetails && offerStatus === "Offer received") {
    if (typeof (offerDetails as any).offered_amount === "number") {
      financingOffered = `RM ${Number((offerDetails as any).offered_amount).toLocaleString("en-MY", {
        minimumFractionDigits: 2,
      })}`;
    }
    if (typeof (offerDetails as any).offered_profit_rate_percent === "number") {
      profitRate = `${(offerDetails as any).offered_profit_rate_percent}%`;
    }
  }

  return {
    id: apiInvoice.id,
    number: String(details.invoice_number ?? details.number ?? "—"),
    maturityDate: details.maturity_date
      ? String(details.maturity_date)
      : null,
    value:
      typeof details.value === "number"
        ? details.value
        : typeof details.invoice_value === "number"
          ? details.invoice_value
          : null,
    appliedFinancing:
      typeof details.applied_financing === "number"
        ? details.applied_financing
        : typeof details.financing_amount === "number"
          ? details.financing_amount
          : null,
    document: String(details.document_name ?? details.document ?? "—"),
    financingOffered,
    profitRate,
    status: apiInvoice.status ?? "DRAFT",
    offerStatus,
    canReviewOffer,
  };
}

/* ============================================================
   normalizeApplication — convert API application to UI application
   ============================================================ */

export function normalizeApplication(apiApplication: ApiApplication): NormalizedApplication {
  const structureType = (
    apiApplication.financing_structure as { structure_type?: string } | undefined
  )?.structure_type;
  const contract = apiApplication.contract;
  const contractStatus = contract?.status ?? null;

  /* Map API status to config badge key (STATUS_BADGES keys) */
  const apiStatus = String(apiApplication.status ?? "DRAFT").toUpperCase();
  const statusMap: Record<string, string> = {
    DRAFT: "draft",
    SUBMITTED: "pending_approval",
    UNDER_REVIEW: "under_review",
    RESUBMITTED: "pending_approval",
    AMENDMENT_REQUESTED: "pending_amendment",
    APPROVED: "accepted",
    REJECTED: "rejected",
    ARCHIVED: "withdrawn",
  };
  const statusKey = statusMap[apiStatus] ?? apiStatus.toLowerCase();

  /* Build badges: app status + offer status if present */
  const badges: string[] = [];
  if (statusKey && statusKey !== "sent") {
    badges.push(statusKey);
  }
  const contractOfferStatus = contract
    ? getOfferStatus({
        status: contract.status,
        offer_details: contract.offer_details,
      })
    : null;
  if (contractOfferStatus === "Offer received") {
    badges.push("sent");
  } else if (contractOfferStatus === "Offer expired") {
    badges.push("sent"); /* Show "Offer Received" badge; UI can show expired state */
  }

  /* Check invoice offers for additional badges and expired state */
  const invoices = apiApplication.invoices ?? [];
  let hasExpiredOffer = false;
  for (const inv of invoices) {
    const invOfferStatus = getOfferStatus({
      status: inv.status,
      offer_details: inv.offer_details,
    });
    if (invOfferStatus === "Offer received" && !badges.includes("sent")) {
      badges.push("sent");
    }
    if (invOfferStatus === "Offer expired") {
      hasExpiredOffer = true;
    }
  }
  if (contractOfferStatus === "Offer expired") {
    hasExpiredOffer = true;
  }

  /* Determine card type from financing structure */
  let type: "Contract financing" | "Invoice financing" | "Generic" = "Generic";
  if (apiApplication.status === "DRAFT" && !structureType) {
    type = "Generic";
  } else if (structureType === "invoice_only") {
    type = "Invoice financing";
  } else if (structureType === "existing_contract" || structureType === "new_contract") {
    type = "Contract financing";
  } else {
    type = contract ? "Contract financing" : "Invoice financing";
  }

  /* Extract customer and contract title from contract_details / customer_details */
  const contractDetails = (contract?.contract_details ?? {}) as Record<string, unknown>;
  const customerDetails = (contract?.customer_details ?? {}) as Record<string, unknown>;
  const companyDetails = (apiApplication as any).company_details ?? {};
  const customer =
    String(
      customerDetails.customer_name ??
        customerDetails.name ??
        companyDetails.customer_name ??
        companyDetails.company_name ??
        "—"
    ) || "—";
  const contractTitle = contractDetails.title
    ? String(contractDetails.title)
    : contractDetails.contract_title
      ? String(contractDetails.contract_title)
      : null;

  /* Contract value and facility from contract_details or review_and_submit */
  const reviewAndSubmit = (apiApplication as any).review_and_submit as Record<string, unknown> | undefined;
  let contractValue: number | null = null;
  let facilityApplied: number | null = null;
  let approvedFacility = "N/A";

  if (contractDetails.contract_value != null) {
    contractValue = Number(contractDetails.contract_value);
  } else if (contractDetails.value != null) {
    contractValue = Number(contractDetails.value);
  }
  if (contractDetails.facility_applied != null) {
    facilityApplied = Number(contractDetails.facility_applied);
  } else if (contractDetails.financing_amount != null) {
    facilityApplied = Number(contractDetails.financing_amount);
  }
  if (contract?.offer_details && (contract.offer_details as any).offered_facility != null) {
    approvedFacility = `RM ${Number((contract.offer_details as any).offered_facility).toLocaleString("en-MY", {
      minimumFractionDigits: 2,
    })}`;
  } else if (reviewAndSubmit?.approved_facility != null) {
    approvedFacility = String(reviewAndSubmit.approved_facility);
  }

  const created = apiApplication.created_at
    ? new Date(apiApplication.created_at)
    : new Date();
  const updated = apiApplication.updated_at
    ? new Date(apiApplication.updated_at)
    : created;

  return {
    id: apiApplication.id,
    type,
    status: statusKey,
    badges,
    hasExpiredOffer,
    contractTitle,
    customer,
    applicationDate: created.toISOString().slice(0, 10),
    contractValue,
    facilityApplied,
    approvedFacility,
    updatedAt: updated.toISOString(),
    invoices: invoices.map((inv) => normalizeInvoice(inv, contractStatus)),
    contractStatus,
  };
}
