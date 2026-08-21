/**
 * Dual-ledger contract capacity: revolving facility (financing amounts) and
 * lifetime cap (invoice face values). Invoices/notes are the source of truth.
 *
 * See docs/guides/application-flow/contract-offer-facility-flow.md
 */

import { Prisma } from "@prisma/client";

export type ContractDetailsLike = Record<string, unknown> | null | undefined;
export type OfferDetailsLike = Record<string, unknown> | null | undefined;

export type FacilityNoteOccupancy = {
  status?: string | null;
  servicingStatus?: string | null;
  fundingStatus?: string | null;
  listingStatus?: string | null;
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

export type ContractLifetimeSnapshot = {
  lifetimeCap: number;
  lifetimeUsed: number;
  lifetimeRemaining: number;
};

export type ContractCapacitySnapshot = ContractFacilitySnapshot &
  ContractLifetimeSnapshot & {
    requestedFacility: number;
    contractValue: number;
  };

/** Field names used for requested facility across different UI/configs. Checked in order. */
const REQUESTED_FACILITY_KEYS = [
  "financing",
  "value",
  "facility_applied",
  "contract_value",
] as const;

const REQUESTED_INVOICE_FINANCING_KEYS = ["applied_financing", "financing_amount"] as const;
const INVOICE_FACE_KEYS = ["value", "invoice_value"] as const;
const CONTRACT_FACE_KEYS = ["value", "contract_value"] as const;

/** Facility line is in force (accepted ceiling still applies). */
export const APPROVED_LINE_STATUSES = new Set(["APPROVED", "AMENDMENT_REQUESTED"]);

/** Reserve requested financing against the revolving line. */
export const FACILITY_REQUESTED_RESERVE_STATUSES = new Set(["SUBMITTED", "AMENDMENT_REQUESTED"]);

/** Reserve offered financing against the revolving line (pre-approval). */
export const FACILITY_OFFERED_RESERVE_STATUSES = new Set(["OFFER_SENT"]);

/** Live / marketplace occupancy lives on APPROVED invoices. */
export const FACILITY_LIVE_INVOICE_STATUSES = new Set(["APPROVED"]);

/** Invoice statuses that occupy the revolving line (requested, offered, or live). */
export const FACILITY_RESERVED_INVOICE_STATUSES = new Set([
  ...FACILITY_REQUESTED_RESERVE_STATUSES,
  ...FACILITY_OFFERED_RESERVE_STATUSES,
  ...FACILITY_LIVE_INVOICE_STATUSES,
]);

export function isReservedInvoiceStatus(status: string | null | undefined): boolean {
  return FACILITY_RESERVED_INVOICE_STATUSES.has(String(status ?? "").toUpperCase());
}

/** Invoice statuses that release both facility and lifetime. */
export const CAPACITY_RELEASE_INVOICE_STATUSES = new Set([
  "REJECTED",
  "WITHDRAWN",
  "OFFER_EXPIRED",
]);

/** Note statuses that release both facility and lifetime. */
export const CAPACITY_RELEASE_NOTE_STATUSES = new Set(["FAILED_FUNDING", "CANCELLED"]);

const RELEASED_NOTE_STATUSES = new Set(["REPAID", "FAILED_FUNDING", "CANCELLED"]);

/** Funding has closed successfully — occupancy true-ups from commitment to funded principal. */
const DRAWN_NOTE_STATUSES = new Set(["FUNDING", "ACTIVE", "ARREARS", "DEFAULTED", "REPAID"]);
const DRAWN_FUNDING_STATUSES = new Set(["FUNDED", "CLOSED"]);

/** Submitted onward, including settled/repaid. Draft and release statuses do not count. */
export const LIFETIME_COUNT_INVOICE_STATUSES = new Set([
  "SUBMITTED",
  "OFFER_SENT",
  "AMENDMENT_REQUESTED",
  "APPROVED",
]);

const FACILITY_SCALE = 6;

function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

/** Normalize a facility/lifetime amount to Decimal(18,6). */
export function toFacilityDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(toDecimal(value).toFixed(FACILITY_SCALE));
}

export function normalizeFacilityAmount(value: number | string | Prisma.Decimal): number {
  return toFacilityDecimal(value).toNumber();
}

export function compareFacilityAmounts(
  left: number | string | Prisma.Decimal,
  right: number | string | Prisma.Decimal
): number {
  return toFacilityDecimal(left).comparedTo(toFacilityDecimal(right));
}

export function facilityAmountLessThan(
  left: number | string | Prisma.Decimal,
  right: number | string | Prisma.Decimal
): boolean {
  return compareFacilityAmounts(left, right) < 0;
}

export function facilityAmountsEqual(
  left: number | string | Prisma.Decimal,
  right: number | string | Prisma.Decimal
): boolean {
  return compareFacilityAmounts(left, right) === 0;
}

export function addFacilityAmounts(...values: Array<number | string | Prisma.Decimal>): number {
  return normalizeFacilityAmount(
    values.reduce<Prisma.Decimal>((sum, value) => sum.add(toFacilityDecimal(value)), new Prisma.Decimal(0))
  );
}

function addAmounts(...values: Array<number | string | Prisma.Decimal>): number {
  return addFacilityAmounts(...values);
}

function subtractAmounts(
  left: number | string | Prisma.Decimal,
  right: number | string | Prisma.Decimal
): number {
  return normalizeFacilityAmount(toFacilityDecimal(left).sub(toFacilityDecimal(right)));
}

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
 * Contract face value — lifetime cap. Not the requested financing amount.
 */
export function resolveContractValue(cd: ContractDetailsLike): number {
  if (!cd || typeof cd !== "object") return 0;
  for (const key of CONTRACT_FACE_KEYS) {
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
  if (value instanceof Prisma.Decimal) {
    return normalizeFacilityAmount(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? normalizeFacilityAmount(value) : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    try {
      return normalizeFacilityAmount(cleaned);
    } catch {
      return null;
    }
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

function parseNonNegativeAmount(value: unknown): number | null {
  const n = parseFacilityJsonAmount(value);
  return n != null && n >= 0 ? n : null;
}

function ratioPercent(details: Record<string, unknown> | null | undefined): Prisma.Decimal {
  const parsed = parseFacilityJsonAmount(details?.financing_ratio_percent);
  if (parsed != null && parsed > 0) return toFacilityDecimal(parsed);
  return new Prisma.Decimal(60);
}

function valueTimesRatio(details: Record<string, unknown> | null | undefined): number {
  const face = resolveInvoiceFaceValue(details);
  if (face <= 0) return 0;
  return normalizeFacilityAmount(toFacilityDecimal(face).mul(ratioPercent(details)).div(100));
}

/** Invoice face value (lifetime basis). */
export function resolveInvoiceFaceValue(details: Record<string, unknown> | null | undefined): number {
  if (!details || typeof details !== "object") return 0;
  for (const key of INVOICE_FACE_KEYS) {
    const parsed = parsePositiveAmount(details[key]);
    if (parsed != null) return parsed;
  }
  return 0;
}

/**
 * Canonical requested financing: applied_financing / financing_amount, else face × ratio.
 * Ratio defaults to 60 when only face value is present (legacy invoice details).
 */
export function resolveRequestedInvoiceFinancing(
  details: Record<string, unknown> | null | undefined
): number {
  if (!details || typeof details !== "object") return 0;
  for (const key of REQUESTED_INVOICE_FINANCING_KEYS) {
    const parsed = parsePositiveAmount(details[key]);
    if (parsed != null) return parsed;
  }
  return valueTimesRatio(details);
}

export function resolveOfferedInvoiceAmount(
  offer: Record<string, unknown> | null | undefined
): number {
  if (!offer || typeof offer !== "object") return 0;
  return parsePositiveAmount(offer.offered_amount) ?? 0;
}

function requestedInvoiceAmount(details: Record<string, unknown> | null | undefined): number {
  return resolveRequestedInvoiceFinancing(details);
}

/**
 * Committed invoice amount (approved advance): offered_amount, else requested financing.
 * Used as the reservation while a note is still raising.
 */
export function resolveInvoiceFacilityAmount(invoice: InvoiceForFacilityRefresh): number {
  const offered = resolveOfferedInvoiceAmount(invoice.offer_details);
  if (offered > 0) return offered;
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
  return CAPACITY_RELEASE_NOTE_STATUSES.has(String(note.status ?? "").toUpperCase());
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

function invoiceStatusOf(invoice: InvoiceForFacilityRefresh): string {
  return String(invoice.status ?? "").toUpperCase();
}

function noteReleasesCapacity(note: FacilityNoteOccupancy | null | undefined): boolean {
  if (!note) return false;
  return isFailedOrCancelledNote(note);
}

/**
 * Canonical reservation for an invoice that still occupies the revolving line:
 * SUBMITTED / AMENDMENT_REQUESTED → requested financing (fallback offered);
 * OFFER_SENT and approved/open marketplace → offered financing (fallback requested).
 */
export function resolveFacilityReservationAmount(invoice: InvoiceForFacilityRefresh): number {
  const status = invoiceStatusOf(invoice);
  const requested = requestedInvoiceAmount(invoice.details);
  const offered = resolveOfferedInvoiceAmount(invoice.offer_details);
  if (FACILITY_REQUESTED_RESERVE_STATUSES.has(status)) {
    return requested > 0 ? requested : offered;
  }
  return offered > 0 ? offered : requested;
}

/**
 * Amount that occupies the revolving line for one invoice.
 * Reserves requested or offered financing until funding closes; then true-ups to funded principal.
 */
export function resolveInvoiceOccupancyAmount(invoice: InvoiceForFacilityRefresh): number {
  const reserved = resolveFacilityReservationAmount(invoice);
  const note = invoice.note;
  if (!note || !isFacilityNoteDrawnAtFundedAmount(note)) return reserved;
  const funded = parseNonNegativeAmount(note.fundedAmount);
  if (funded != null) return funded;
  return reserved;
}

export function invoiceCountsTowardLifetime(invoice: InvoiceForFacilityRefresh): boolean {
  const status = invoiceStatusOf(invoice);
  if (!LIFETIME_COUNT_INVOICE_STATUSES.has(status)) return false;
  if (CAPACITY_RELEASE_INVOICE_STATUSES.has(status)) return false;
  if (noteReleasesCapacity(invoice.note)) return false;
  return true;
}

export function capacitySnapshotsEqual(
  left: ContractCapacitySnapshot,
  right: ContractCapacitySnapshot
): boolean {
  return (
    facilityAmountsEqual(left.approvedFacility, right.approvedFacility) &&
    facilityAmountsEqual(left.utilizedFacility, right.utilizedFacility) &&
    facilityAmountsEqual(left.pendingFacility, right.pendingFacility) &&
    facilityAmountsEqual(left.repaidFacility, right.repaidFacility) &&
    facilityAmountsEqual(left.availableFacility, right.availableFacility) &&
    facilityAmountsEqual(left.lifetimeCap, right.lifetimeCap) &&
    facilityAmountsEqual(left.lifetimeUsed, right.lifetimeUsed) &&
    facilityAmountsEqual(left.lifetimeRemaining, right.lifetimeRemaining) &&
    facilityAmountsEqual(left.requestedFacility, right.requestedFacility) &&
    facilityAmountsEqual(left.contractValue, right.contractValue)
  );
}

export function facilitySnapshotToDetailsPatch(
  snapshot: ContractFacilitySnapshot & Partial<ContractLifetimeSnapshot>
): Record<string, number> {
  const patch: Record<string, number> = {
    approved_facility: snapshot.approvedFacility,
    utilized_facility: snapshot.utilizedFacility,
    available_facility: snapshot.availableFacility,
    pending_facility: snapshot.pendingFacility,
    repaid_facility: snapshot.repaidFacility,
  };
  if (snapshot.lifetimeCap != null) patch.lifetime_cap = snapshot.lifetimeCap;
  if (snapshot.lifetimeUsed != null) patch.lifetime_used = snapshot.lifetimeUsed;
  if (snapshot.lifetimeRemaining != null) patch.lifetime_remaining = snapshot.lifetimeRemaining;
  return patch;
}

export function capacitySnapshotToColumnValues(snapshot: ContractCapacitySnapshot): {
  approved_facility: Prisma.Decimal;
  utilized_facility: Prisma.Decimal;
  pending_facility: Prisma.Decimal;
  repaid_facility: Prisma.Decimal;
  available_facility: Prisma.Decimal;
  lifetime_cap: Prisma.Decimal;
  lifetime_used: Prisma.Decimal;
  lifetime_remaining: Prisma.Decimal;
} {
  return {
    approved_facility: toFacilityDecimal(snapshot.approvedFacility),
    utilized_facility: toFacilityDecimal(snapshot.utilizedFacility),
    pending_facility: toFacilityDecimal(snapshot.pendingFacility),
    repaid_facility: toFacilityDecimal(snapshot.repaidFacility),
    available_facility: toFacilityDecimal(snapshot.availableFacility),
    lifetime_cap: toFacilityDecimal(snapshot.lifetimeCap),
    lifetime_used: toFacilityDecimal(snapshot.lifetimeUsed),
    lifetime_remaining: toFacilityDecimal(snapshot.lifetimeRemaining),
  };
}

export function toFacilityNoteOccupancy(note: {
  status?: string | null;
  servicing_status?: string | null;
  funding_status?: string | null;
  listing_status?: string | null;
  funded_amount?: unknown;
  target_amount?: unknown;
} | null | undefined): FacilityNoteOccupancy | null {
  if (!note) return null;
  return {
    status: note.status,
    servicingStatus: note.servicing_status,
    fundingStatus: note.funding_status,
    listingStatus: note.listing_status,
    fundedAmount: parseFacilityJsonAmount(note.funded_amount),
    targetAmount: parseFacilityJsonAmount(note.target_amount),
  };
}

export function emptyCapacitySnapshot(): ContractCapacitySnapshot {
  return {
    approvedFacility: 0,
    utilizedFacility: 0,
    pendingFacility: 0,
    repaidFacility: 0,
    availableFacility: 0,
    lifetimeCap: 0,
    lifetimeUsed: 0,
    lifetimeRemaining: 0,
    requestedFacility: 0,
    contractValue: 0,
  };
}

/**
 * Dual-ledger occupancy:
 * - utilized = live approved draws (offered while raising; funded principal after close)
 * - pending = SUBMITTED / AMENDMENT_REQUESTED (requested) and OFFER_SENT (offered);
 *   pending reduces available but is kept separate from utilized
 * - repaid = settled approved draws (funded principal when known)
 * - available = approved − utilized − pending (may be negative; legacy over-limit is preserved)
 * - lifetime used = invoice face values from submitted onward, including settled/repaid
 * Approved facility itself never increases on repayment.
 */
export function computeContractFacilitySnapshot(
  contractStatus: string,
  contractDetails: ContractDetailsLike,
  invoices: InvoiceForFacilityRefresh[]
): ContractCapacitySnapshot {
  const approvedFacility = resolveApprovedFacilityForRefresh(contractStatus, contractDetails);
  const requestedFacility = resolveRequestedFacility(contractDetails);
  const contractValue = resolveContractValue(contractDetails);
  let utilizedFacility = 0;
  let pendingFacility = 0;
  let repaidFacility = 0;
  let lifetimeUsed = 0;

  for (const invoice of invoices) {
    const status = invoiceStatusOf(invoice);
    if (status === "DRAFT" || CAPACITY_RELEASE_INVOICE_STATUSES.has(status)) {
      continue;
    }

    if (invoiceCountsTowardLifetime(invoice)) {
      lifetimeUsed = addAmounts(lifetimeUsed, resolveInvoiceFaceValue(invoice.details));
    }

    if (FACILITY_REQUESTED_RESERVE_STATUSES.has(status) || FACILITY_OFFERED_RESERVE_STATUSES.has(status)) {
      pendingFacility = addAmounts(pendingFacility, resolveFacilityReservationAmount(invoice));
      continue;
    }

    if (!FACILITY_LIVE_INVOICE_STATUSES.has(status)) continue;
    if (noteReleasesCapacity(invoice.note)) continue;

    if (isReleasedFacilityNote(invoice.note)) {
      if (isSettledFacilityNote(invoice.note) && invoice.note && !isFailedOrCancelledNote(invoice.note)) {
        repaidFacility = addAmounts(repaidFacility, resolveInvoiceOccupancyAmount(invoice));
      }
      continue;
    }

    utilizedFacility = addAmounts(utilizedFacility, resolveInvoiceOccupancyAmount(invoice));
  }

  const occupied = addAmounts(utilizedFacility, pendingFacility);
  return {
    approvedFacility,
    utilizedFacility,
    pendingFacility,
    repaidFacility,
    availableFacility: subtractAmounts(approvedFacility, occupied),
    lifetimeCap: contractValue,
    lifetimeUsed,
    lifetimeRemaining: subtractAmounts(contractValue, lifetimeUsed),
    requestedFacility,
    contractValue,
  };
}

/** Alias for the dual-ledger snapshot. */
export const computeContractCapacitySnapshot = computeContractFacilitySnapshot;
