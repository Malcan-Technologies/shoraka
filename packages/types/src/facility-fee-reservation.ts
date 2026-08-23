import { roundNoteMoney } from "./note-expected-return";
import { parseFacilityFeeCollectionWaiver, parseInvoiceFeeSchedule } from "./fee-schedule";

export type FacilityFeeReservationInvoice = {
  id: string;
  status?: string | null;
  offerDetails?: unknown;
};

export type FacilityFeeReservationNote = {
  sourceInvoiceId?: string | null;
  status?: string | null;
  fundingStatus?: string | null;
  servicingStatus?: string | null;
  invoiceSnapshot?: unknown;
};

/**
 * Invoice states that are not a still-collectible utilisation promise.
 * SUBMITTED / AMENDMENT_REQUESTED leftover schedules still count (least permissive).
 */
const RELEASE_INVOICE_STATUSES = new Set(["DRAFT", "REJECTED", "WITHDRAWN", "OFFER_EXPIRED"]);

/** Note states that release a frozen collection without charging remaining. */
const RELEASE_NOTE_STATUSES = new Set(["FAILED_FUNDING", "CANCELLED"]);

/**
 * Successful funding close charges facility fee in the same transaction, so
 * `facility_fee_paid_amount` / remaining already reflects these notes.
 */
const CHARGED_NOTE_STATUSES = new Set(["FUNDING", "ACTIVE", "ARREARS", "DEFAULTED", "REPAID"]);
const CHARGED_FUNDING_STATUSES = new Set(["FUNDED", "CLOSED"]);

function upper(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase();
}

export function isReleasedFacilityFeeInvoiceStatus(status: string | null | undefined): boolean {
  return RELEASE_INVOICE_STATUSES.has(upper(status));
}

export function isReleasedFacilityFeeNoteStatus(status: string | null | undefined): boolean {
  return RELEASE_NOTE_STATUSES.has(upper(status));
}

export function isChargedFacilityFeeNote(note: FacilityFeeReservationNote | null | undefined): boolean {
  if (!note) return false;
  if (isReleasedFacilityFeeNoteStatus(note.status)) return false;
  const servicing = upper(note.servicingStatus);
  return (
    CHARGED_NOTE_STATUSES.has(upper(note.status)) ||
    CHARGED_FUNDING_STATUSES.has(upper(note.fundingStatus)) ||
    servicing === "SETTLED"
  );
}

export function reservedFacilityFeeCollectAmount(
  invoice: FacilityFeeReservationInvoice,
  note: FacilityFeeReservationNote | null | undefined
): number {
  if (isReleasedFacilityFeeInvoiceStatus(invoice.status)) return 0;
  const schedule = parseInvoiceFeeSchedule(invoice.offerDetails);
  if (!schedule) return 0;
  const amount = roundNoteMoney(Math.max(0, schedule.facilityFeeCollectAmount));
  if (!(amount > 0)) return 0;
  if (note) {
    if (isReleasedFacilityFeeNoteStatus(note.status)) return 0;
    if (parseFacilityFeeCollectionWaiver(note.invoiceSnapshot)?.facilityFeeCollectionWaived) {
      return 0;
    }
    if (isChargedFacilityFeeNote(note)) return 0;
  }
  return amount;
}

export function sumReservedFacilityFeeCollections(input: {
  invoices: FacilityFeeReservationInvoice[];
  notes: FacilityFeeReservationNote[];
  excludeInvoiceId?: string | null;
}): number {
  const noteByInvoiceId = new Map<string, FacilityFeeReservationNote>();
  for (const note of input.notes) {
    if (!note.sourceInvoiceId) continue;
    noteByInvoiceId.set(note.sourceInvoiceId, note);
  }
  let reserved = 0;
  for (const invoice of input.invoices) {
    if (input.excludeInvoiceId && invoice.id === input.excludeInvoiceId) continue;
    reserved = roundNoteMoney(
      reserved + reservedFacilityFeeCollectAmount(invoice, noteByInvoiceId.get(invoice.id) ?? null)
    );
  }
  return reserved;
}

export function uncommittedFacilityFeeRemaining(remaining: number, reserved: number): number {
  return Math.max(0, roundNoteMoney(Math.max(0, remaining) - Math.max(0, reserved)));
}

/** Gross remaining minus still-collectible sibling v1 reservations. Current invoice excluded for resend. */
export function availableFacilityFeeToReserve(input: {
  remaining: number;
  invoices: FacilityFeeReservationInvoice[];
  notes: FacilityFeeReservationNote[];
  excludeInvoiceId?: string | null;
}): number {
  return uncommittedFacilityFeeRemaining(
    input.remaining,
    sumReservedFacilityFeeCollections({
      invoices: input.invoices,
      notes: input.notes,
      excludeInvoiceId: input.excludeInvoiceId,
    })
  );
}

export function facilityFeeCollectExceedsUncommitted(input: {
  proposedCollectAmount: number;
  remaining: number;
  reserved: number;
}): boolean {
  const available = uncommittedFacilityFeeRemaining(input.remaining, input.reserved);
  return input.proposedCollectAmount - available > 1e-9;
}
