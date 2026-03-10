/**
 * Adapter: converts API/Prisma response shapes into flat UI-ready objects.
 *
 * Input: Raw API response (Prisma Application with nested contract, invoices, offer_details).
 * Output: NormalizedApplication with cardStatus, offerExpiresAt, flattened invoice fields.
 *
 * Example: API returns offer_details.expires_at, we output offerExpiresAt.
 * Components never receive raw API data.
 */

import { getOfferStatus } from "@/lib/offer-utils";
import {
  computeApplicationCardStatus,
  type CardStatusResult,
} from "../lib/compute-application-card-status";

/* ============================================================
   API TYPES — shapes returned by Prisma/API (snake_case, nested)
   ============================================================ */

/** Raw contract from the API (Prisma Contract with relations). */
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

/** Raw invoice from the API (Prisma Invoice). */
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

/** Raw application from the API (Prisma Application with contract and invoices). */
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
   UI TYPES — shapes passed to components (camelCase, flat)
   ============================================================ */

/** Normalized offer for display. */
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

/** Normalized invoice for the UI. */
export interface NormalizedInvoice {
  id: string;
  number: string;
  maturityDate: string | null;
  value: number | null;
  appliedFinancing: number | null;
  document: string;
  /** S3 key from details.document.s3_key. Used for getS3DownloadUrl presigned link. */
  documentS3Key: string | null;
  financingOffered: string;
  profitRate: string;
  status: string;
  offerStatus: "Offer received" | "Offer expired" | null;
  /** True when Review Offer enabled. Invoice offers require contractStatus === APPROVED. */
  canReviewOffer: boolean;
  /** From offer_details.expires_at. Shown as "Offer valid until: DD Mon YYYY". */
  offerExpiresAt: string | null;
}

/** Normalized application for the UI. Card shows exactly one status badge from cardStatus. */
export interface NormalizedApplication {
  id: string;
  type: "Contract financing" | "Invoice financing" | "Generic";
  /** Badge key for filtering; matches cardStatus.badgeKey. */
  status: string;
  /** Single computed status for the card. Only one badge is shown. */
  cardStatus: CardStatusResult;
  /** True when the contract or any invoice has an offer that has expired. */
  hasExpiredOffer: boolean;
  contractTitle: string | null;
  customer: string;
  applicationDate: string;
  contractValue: number | null;
  facilityApplied: number | null;
  approvedFacility: string;
  updatedAt: string;
  invoices: NormalizedInvoice[];
  /** Contract status. Invoice Review Offer is only enabled when this is APPROVED. */
  contractStatus: string | null;
  /** Offer expiry for card-level "Offer valid until" display. From contract or first SENT invoice. */
  offerExpiresAt: string | null;
}

/* ============================================================
   normalizeOffer — contract or invoice offer_details from Prisma
   IN:  { expires_at, offered_facility } (from contract) or { offered_amount } (from invoice)
   OUT: { expiresAt, offeredFacility } or { offeredAmount }
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
   normalizeInvoice — Prisma Invoice to NormalizedInvoice for table row
   IN:  API invoice with details.document (s3_key, file_name), offer_details.expires_at
   OUT: document, documentS3Key, offerExpiresAt, canReviewOffer (contract must be APPROVED for invoice offers)
   ============================================================ */

export function normalizeInvoice(
  apiInvoice: ApiInvoice,
  contractStatus: string | null
): NormalizedInvoice {
  const details = (apiInvoice.details ?? {}) as Record<string, unknown>;
  const doc = details.document as { s3_key?: string; file_name?: string } | undefined;
  const documentS3Key = doc?.s3_key ? String(doc.s3_key) : null;
  const documentName =
    String(doc?.file_name ?? details.document_name ?? details.document ?? "—");

  const offerDetails = apiInvoice.offer_details;
  const offerStatus = getOfferStatus({
    status: apiInvoice.status,
    offer_details: offerDetails,
  });

  /* Invoice Review Offer is only enabled when contract is approved (or no contract) */
  const canReviewOffer =
    offerStatus === "Offer received" &&
    (contractStatus === "APPROVED" || !contractStatus);

  const offerExpiresAt =
    offerDetails?.expires_at != null ? String(offerDetails.expires_at) : null;

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
    document: documentName,
    documentS3Key,
    financingOffered,
    profitRate,
    status: apiInvoice.status ?? "DRAFT",
    offerStatus,
    canReviewOffer,
    offerExpiresAt,
  };
}

/* ============================================================
   normalizeApplication — Prisma Application to NormalizedApplication for card
   IN:  Raw API application (nested contract, invoices, financing_structure)
   OUT: cardStatus (from computeApplicationCardStatus), invoices[], offerExpiresAt, contractStatus
   ============================================================ */

export function normalizeApplication(apiApplication: ApiApplication): NormalizedApplication {
  const structureType = (
    apiApplication.financing_structure as { structure_type?: string } | undefined
  )?.structure_type;
  const contract = apiApplication.contract;
  const contractStatus = contract?.status ?? null;

  const invoices = apiApplication.invoices ?? [];
  const invoiceStatuses = invoices.map((inv) => inv.status ?? "DRAFT");

  /* Single card status from priority logic. Aggregates invoice statuses first. */
  const cardStatus = computeApplicationCardStatus({
    applicationStatus: apiApplication.status ?? "DRAFT",
    contractStatus: contract?.status ?? null,
    invoiceStatuses,
  });

  /* Expired offer affects Review Offer button; card status label stays "Offer Received". */
  const contractOfferStatus = contract
    ? getOfferStatus({
        status: contract.status,
        offer_details: contract.offer_details,
      })
    : null;
  let hasExpiredOffer = contractOfferStatus === "Offer expired";
  for (const inv of invoices) {
    const invOfferStatus = getOfferStatus({
      status: inv.status,
      offer_details: inv.offer_details,
    });
    if (invOfferStatus === "Offer expired") hasExpiredOffer = true;
  }

  /* Determine card type and financing label from financing structure.
   * invoice_only becomes "Invoice Financing"; existing_contract | new_contract becomes "Contract Financing".
   * If status is DRAFT and financing_structure is null, type is Generic (no financing label shown). */
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

  /* Offer expiry for card-level display. Contract SENT uses contract expiry; else first invoice SENT expiry. */
  let offerExpiresAt: string | null = null;
  if (contractStatus === "SENT" && contract?.offer_details?.expires_at) {
    offerExpiresAt = String(contract.offer_details.expires_at);
  } else {
    const sentInv = invoices.find((i) => i.status === "SENT" && i.offer_details?.expires_at);
    if (sentInv?.offer_details?.expires_at) {
      offerExpiresAt = String(sentInv.offer_details.expires_at);
    }
  }

  return {
    id: apiApplication.id,
    type,
    status: cardStatus.badgeKey,
    cardStatus,
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
    offerExpiresAt,
  };
}
