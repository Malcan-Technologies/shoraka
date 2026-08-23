import {
  facilityFeeCollectExceedsUncommitted,
  inspectInvoiceFeeSchedule,
  resolveFacilityFeeBalance,
  roundNoteMoney,
  settleDisbursementFees,
  sumReservedFacilityFeeCollections,
  type DisbursementFeeSettlement,
} from "@cashsouk/types";
import { Prisma } from "@prisma/client";
import { AppError } from "./http/error-handler";
import { assertFacilityIsEnabled } from "../modules/applications/split-origination-guards";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type FacilityFeeCollectReservationTx = {
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
  invoice: {
    findMany: Prisma.TransactionClient["invoice"]["findMany"];
  };
  note: {
    findMany: Prisma.TransactionClient["note"]["findMany"];
  };
};

/**
 * Lock sibling invoices then notes (ORDER BY id) and sum still-collectible v1
 * reservations. Caller must already hold the contract row lock.
 */
export async function loadReservedFacilityFeeCollections(
  tx: FacilityFeeCollectReservationTx,
  input: {
    contractId: string;
    excludeInvoiceId?: string | null;
  }
): Promise<number> {
  await tx.$queryRaw`
    SELECT id FROM invoices WHERE contract_id = ${input.contractId} ORDER BY id FOR UPDATE
  `;
  await tx.$queryRaw`
    SELECT id FROM notes WHERE source_contract_id = ${input.contractId} ORDER BY id FOR UPDATE
  `;

  const invoices = await tx.invoice.findMany({
    where: { contract_id: input.contractId },
    select: { id: true, status: true, offer_details: true },
  });
  const notes = await tx.note.findMany({
    where: { source_contract_id: input.contractId },
    select: {
      source_invoice_id: true,
      status: true,
      funding_status: true,
      servicing_status: true,
      invoice_snapshot: true,
    },
  });
  return sumReservedFacilityFeeCollections({
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      offerDetails: invoice.offer_details,
    })),
    notes: notes.map((note) => ({
      sourceInvoiceId: note.source_invoice_id,
      status: note.status,
      fundingStatus: note.funding_status,
      servicingStatus: note.servicing_status,
      invoiceSnapshot: note.invoice_snapshot,
    })),
    excludeInvoiceId: input.excludeInvoiceId,
  });
}

/**
 * Reject facility-linked utilisation offers on a disabled contract, and keep
 * uncharged v1 facility-fee collections from overcommitting remaining owed.
 * Caller must already hold the contract row lock in this transaction.
 */
export async function assertFacilityLinkedInvoiceOfferFees(
  tx: FacilityFeeCollectReservationTx,
  input: {
    contractId: string;
    currentInvoiceId: string;
    proposedCollectAmount: number;
    contractDetails: unknown;
  }
): Promise<void> {
  assertFacilityIsEnabled({
    id: input.contractId,
    contract_details: input.contractDetails,
  });
  if (!(input.proposedCollectAmount > 0)) return;

  const remaining = resolveFacilityFeeBalance(input.contractDetails).remaining;
  const reserved = await loadReservedFacilityFeeCollections(tx, {
    contractId: input.contractId,
    excludeInvoiceId: input.currentInvoiceId,
  });
  if (
    facilityFeeCollectExceedsUncommitted({
      proposedCollectAmount: input.proposedCollectAmount,
      remaining,
      reserved,
    })
  ) {
    const available = Math.max(0, remaining - reserved);
    throw new AppError(
      400,
      "FACILITY_FEE_COLLECT_EXCEEDS_REMAINING",
      `Facility fee collection cannot exceed remaining facility fee of ${available.toFixed(2)}`
    );
  }
}

/**
 * Accept of a facility-linked invoice: facility must still be enabled.
 * Remaining is re-checked unless remaining facility fee was waived (close then
 * collects RM 0). Sibling reservations exclude this invoice.
 */
export async function assertFacilityLinkedInvoiceAcceptFees(
  tx: FacilityFeeCollectReservationTx,
  input: {
    contractId: string;
    currentInvoiceId: string;
    proposedCollectAmount: number;
    contractDetails: unknown;
  }
): Promise<void> {
  assertFacilityIsEnabled({
    id: input.contractId,
    contract_details: input.contractDetails,
  });
  if (resolveFacilityFeeBalance(input.contractDetails).waived) return;
  if (!(input.proposedCollectAmount > 0)) return;
  await assertFacilityLinkedInvoiceOfferFees(tx, input);
}

export function assertInvoiceFeeScheduleChargeable(offerDetails: unknown) {
  const inspected = inspectInvoiceFeeSchedule(offerDetails);
  if (inspected.present && !inspected.ok) {
    throw new AppError(
      409,
      "FEE_SCHEDULE_INVALID",
      "This note's locked fee schedule is invalid. Funding cannot close until the schedule is valid, so we do not charge less than the offer."
    );
  }
  return inspected;
}

export function assertFrozenFacilityFeeCollectable(input: {
  frozenCollectAmount: number;
  remaining: number;
  noteWaived?: boolean;
  contractWaived?: boolean;
}): void {
  if (input.noteWaived || input.contractWaived) return;
  const frozen = roundNoteMoney(Math.max(0, input.frozenCollectAmount));
  if (!(frozen > 0)) return;
  const remaining = roundNoteMoney(Math.max(0, input.remaining));
  if (frozen - remaining > 1e-9) {
    throw new AppError(
      409,
      "FACILITY_FEE_FROZEN_COLLECT_INVARIANT",
      `Frozen facility fee collection of ${frozen.toFixed(2)} exceeds remaining facility fee of ${remaining.toFixed(2)}`
    );
  }
}

export async function settleCloseFundingFacilityFees(
  tx: FacilityFeeCollectReservationTx,
  input: {
    contractId: string;
    currentInvoiceId?: string | null;
    fundedAmount: number;
    platformFeeRatePercent: number;
    offerDetails: unknown;
    invoiceSnapshot?: unknown;
    approvedFacilityAmount: number;
    facilityFeeRatePercent: number;
    facilityFeePaidBefore: number;
    contractDetails: unknown;
  }
): Promise<DisbursementFeeSettlement> {
  const reserved = await loadReservedFacilityFeeCollections(tx, {
    contractId: input.contractId,
    excludeInvoiceId: input.currentInvoiceId,
  });
  const remaining = resolveFacilityFeeBalance({
    ...asRecord(input.contractDetails),
    approved_facility: input.approvedFacilityAmount,
    facility_fee_rate_percent: input.facilityFeeRatePercent,
    facility_fee_paid_amount: input.facilityFeePaidBefore,
  }).remaining;
  const inspected = assertInvoiceFeeScheduleChargeable(input.offerDetails);
  const settled = settleDisbursementFees({
    fundedAmount: input.fundedAmount,
    platformFeeRatePercent: input.platformFeeRatePercent,
    offerDetails: input.offerDetails,
    invoiceSnapshot: input.invoiceSnapshot,
    approvedFacilityAmount: input.approvedFacilityAmount,
    facilityFeeRatePercent: input.facilityFeeRatePercent,
    facilityFeePaidBefore: input.facilityFeePaidBefore,
    contractDetails: input.contractDetails,
    reservedFacilityFeeCollect: reserved,
  });
  if (settled.mode === "schedule") {
    assertFrozenFacilityFeeCollectable({
      frozenCollectAmount: inspected.schedule?.facilityFeeCollectAmount ?? 0,
      remaining,
      noteWaived: settled.facilityFeeCollectionWaived,
      contractWaived: settled.contractFacilityFeeWaived,
    });
  }
  return settled;
}
