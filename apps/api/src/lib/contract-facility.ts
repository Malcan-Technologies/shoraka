/**
 * Shared helpers for contract facility values (requested, offered, approved).
 * Single source of truth for resolving facility amounts from contract_details and offer_details.
 *
 * See docs/guides/application-flow/contract-offer-facility-flow.md for the full flow.
 */

export type ContractDetailsLike = Record<string, unknown> | null | undefined;
export type OfferDetailsLike = Record<string, unknown> | null | undefined;

export type FacilityNoteOccupancy = {
  status?: string | null;
  servicingStatus?: string | null;
  fundingStatus?: string | null;
  fundedAmount?: number | string | null;
  targetAmount?: number | string | null;
};

export interface InvoiceForFacilityRefresh {
  status?: string | null;
  details?: Record<string, unknown> | null;
  offer_details?: Record<string, unknown> | null;
  note?: FacilityNoteOccupancy | null;
}

export type ContractFacilitySnapshot = {
  approvedFacility: number;
  utilizedFacility: number;
  pendingFacility: number;
  repaidFacility: number;
  availableFacility: number;
};

/** Field names used for requested facility across different UI/configs. Checked in order. */
const REQUESTED_FACILITY_KEYS = [
  "financing",
  "value",
  "facility_applied",
  "contract_value",
] as const;

const PENDING_INVOICE_STATUSES = new Set(["SUBMITTED", "OFFER_SENT", "AMENDMENT_REQUESTED"]);
const APPROVED_LINE_STATUSES = new Set(["APPROVED", "AMENDMENT_REQUESTED"]);
const RELEASED_NOTE_STATUSES = new Set(["REPAID", "FAILED_FUNDING", "CANCELLED"]);
const FAILED_OR_CANCELLED_NOTE_STATUSES = new Set(["FAILED_FUNDING", "CANCELLED"]);
/** Funding has closed successfully — occupancy true-ups from commitment to funded principal. */
const DRAWN_NOTE_STATUSES = new Set(["FUNDING", "ACTIVE", "ARREARS", "DEFAULTED", "REPAID"]);
const DRAWN_FUNDING_STATUSES = new Set(["FUNDED", "CLOSED"]);

/**
 * Resolve the requested facility amount from contract_details.
 * Used when sending offers (admin) and for display.
 */
export function resolveRequestedFacility(cd: ContractDetailsLike): number {
  if (!cd || typeof cd !== "object") return 0;
  for (const key of REQUESTED_FACILITY_KEYS) {
    const parsed = parsePositiveAmount(cd[key]);
    if (parsed != null) return parsed;
  }
  return 0;
}

/**
 * Resolve approved facility for capacity calculations.
 * Non-zero when the accepted ceiling is still in force: APPROVED, or AMENDMENT_REQUESTED
 * after the issuer already accepted (the line itself is not withdrawn).
 * Otherwise 0 (SUBMITTED, OFFER_SENT, REJECTED, DRAFT).
 */
export function resolveApprovedFacilityForRefresh(
  contractStatus: string,
  cd: ContractDetailsLike
): number {
  if (!APPROVED_LINE_STATUSES.has(contractStatus)) return 0;
  return parsePositiveAmount(cd?.approved_facility) ?? 0;
}

/**
 * Resolve offered facility from offer_details.
 */
export function resolveOfferedFacility(offer: OfferDetailsLike): number {
  if (!offer || typeof offer !== "object") return 0;
  return parsePositiveAmount(offer.offered_facility) ?? 0;
}

export function parseFacilityJsonAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value !== null && typeof (value as { toString?: unknown }).toString === "function") {
    return parseFacilityJsonAmount(String(value));
  }
  return null;
}

function parsePositiveAmount(value: unknown): number | null {
  const n = parseFacilityJsonAmount(value);
  return n != null && n > 0 ? n : null;
}

function requestedInvoiceAmount(details: Record<string, unknown> | null | undefined): number {
  const value = parsePositiveAmount(details?.value) ?? 0;
  const ratio = parseFacilityJsonAmount(details?.financing_ratio_percent) ?? 60;
  const safeRatio = ratio > 0 ? ratio : 60;
  return value * (safeRatio / 100);
}

/**
 * Committed invoice amount (approved advance): offered_amount, else value × ratio.
 * Used for pending invoices and as the reservation while a note is still raising.
 */
export function resolveInvoiceFacilityAmount(invoice: InvoiceForFacilityRefresh): number {
  const offered = parsePositiveAmount(invoice.offer_details?.offered_amount);
  if (offered != null) return offered;
  return requestedInvoiceAmount(invoice.details);
}

export function isReleasedFacilityNote(note: FacilityNoteOccupancy | null | undefined): boolean {
  if (!note) return false;
  const status = String(note.status ?? "").toUpperCase();
  const servicing = String(note.servicingStatus ?? "").toUpperCase();
  return RELEASED_NOTE_STATUSES.has(status) || servicing === "SETTLED";
}

export function isSettledFacilityNote(note: FacilityNoteOccupancy | null | undefined): boolean {
  if (!note) return false;
  const status = String(note.status ?? "").toUpperCase();
  const servicing = String(note.servicingStatus ?? "").toUpperCase();
  return status === "REPAID" || servicing === "SETTLED";
}

function isFailedOrCancelledNote(note: FacilityNoteOccupancy): boolean {
  return FAILED_OR_CANCELLED_NOTE_STATUSES.has(String(note.status ?? "").toUpperCase());
}

/**
 * True once funding has closed successfully. Until then the approved advance is reserved
 * so a second invoice cannot consume the same remaining capacity mid-raise.
 */
export function isFacilityNoteDrawnAtFundedAmount(
  note: FacilityNoteOccupancy | null | undefined
): boolean {
  if (!note) return false;
  const status = String(note.status ?? "").toUpperCase();
  const funding = String(note.fundingStatus ?? "").toUpperCase();
  if (isFailedOrCancelledNote(note)) return false;
  return DRAWN_NOTE_STATUSES.has(status) || DRAWN_FUNDING_STATUSES.has(funding);
}

/**
 * Amount that occupies the revolving line for one invoice.
 * Reserves the committed advance until funding closes; then true-ups to funded principal.
 */
export function resolveInvoiceOccupancyAmount(invoice: InvoiceForFacilityRefresh): number {
  const committed = resolveInvoiceFacilityAmount(invoice);
  const note = invoice.note;
  if (!note || !isFacilityNoteDrawnAtFundedAmount(note)) return committed;
  const funded = parseFacilityJsonAmount(note.fundedAmount);
  if (funded != null && funded >= 0) return funded;
  return committed;
}

export function facilitySnapshotToDetailsPatch(
  snapshot: ContractFacilitySnapshot
): Record<string, number> {
  return {
    approved_facility: snapshot.approvedFacility,
    utilized_facility: snapshot.utilizedFacility,
    available_facility: snapshot.availableFacility,
    pending_facility: snapshot.pendingFacility,
    repaid_facility: snapshot.repaidFacility,
  };
}

export function toFacilityNoteOccupancy(note: {
  status?: string | null;
  servicing_status?: string | null;
  funding_status?: string | null;
  funded_amount?: unknown;
  target_amount?: unknown;
} | null | undefined): FacilityNoteOccupancy | null {
  if (!note) return null;
  return {
    status: note.status,
    servicingStatus: note.servicing_status,
    fundingStatus: note.funding_status,
    fundedAmount: parseFacilityJsonAmount(note.funded_amount),
    targetAmount: parseFacilityJsonAmount(note.target_amount),
  };
}

/**
 * Revolving occupancy:
 * - utilized = live approved draws. Reserved at the committed advance while raising;
 *   true-ups to funded principal once funding closes (partial books occupy only what funded).
 * - pending = submitted / offer-sent invoices (display only; does not reduce available)
 * - repaid = settled approved draws (funded principal when known)
 * - available = approved − utilized (may be negative if an over-limit offer was accepted)
 * Approved facility itself never increases on repayment.
 */
export function computeContractFacilitySnapshot(
  contractStatus: string,
  contractDetails: ContractDetailsLike,
  invoices: InvoiceForFacilityRefresh[]
): ContractFacilitySnapshot {
  const approvedFacility = resolveApprovedFacilityForRefresh(contractStatus, contractDetails);
  let utilizedFacility = 0;
  let pendingFacility = 0;
  let repaidFacility = 0;

  for (const invoice of invoices) {
    const status = String(invoice.status ?? "").toUpperCase();
    if (PENDING_INVOICE_STATUSES.has(status)) {
      pendingFacility += resolveInvoiceFacilityAmount(invoice);
      continue;
    }
    if (status !== "APPROVED") continue;
    if (isReleasedFacilityNote(invoice.note)) {
      if (isSettledFacilityNote(invoice.note) && !isFailedOrCancelledNote(invoice.note!)) {
        repaidFacility += resolveInvoiceOccupancyAmount(invoice);
      }
      continue;
    }
    utilizedFacility += resolveInvoiceOccupancyAmount(invoice);
  }

  return {
    approvedFacility,
    utilizedFacility,
    pendingFacility,
    repaidFacility,
    availableFacility: approvedFacility - utilizedFacility,
  };
}
