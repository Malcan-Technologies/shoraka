import {
  availableFacilityFeeToReserve,
  resolveFacilityFeeBalance,
  type FacilityFeeReservationInvoice,
  type FacilityFeeReservationNote,
} from "@cashsouk/types";
import { Prisma } from "@prisma/client";

export type FacilityFeeAvailableTargetInvoice = {
  id: string;
  contractId?: string | null;
};

export type FacilityFeeAvailableReservationInvoice = FacilityFeeReservationInvoice & {
  contractId?: string | null;
};

export type FacilityFeeAvailableReservationNote = FacilityFeeReservationNote & {
  sourceContractId?: string | null;
};

export type FacilityFeeAvailableContract = {
  id: string;
  contractDetails: unknown;
  invoices: Array<{ id: string; status?: string | null; offerDetails?: unknown }>;
};

/**
 * Per-invoice uncommitted facility fee available to reserve.
 * Current invoice is excluded so a resend can replace its own reservation.
 */
export function mapFacilityFeeAvailableToReserveByInvoiceId(input: {
  targetInvoices: FacilityFeeAvailableTargetInvoice[];
  remainingByContractId: Map<string, number> | Record<string, number>;
  reservationInvoices: FacilityFeeAvailableReservationInvoice[];
  notes: FacilityFeeAvailableReservationNote[];
}): Map<string, number | null> {
  const remainingByContractId =
    input.remainingByContractId instanceof Map
      ? input.remainingByContractId
      : new Map(Object.entries(input.remainingByContractId));
  const invoicesByContractId = new Map<string, FacilityFeeReservationInvoice[]>();
  for (const invoice of input.reservationInvoices) {
    const contractId = invoice.contractId;
    if (!contractId) continue;
    const list = invoicesByContractId.get(contractId) ?? [];
    list.push({ id: invoice.id, status: invoice.status, offerDetails: invoice.offerDetails });
    invoicesByContractId.set(contractId, list);
  }
  const notesByContractId = new Map<string, FacilityFeeReservationNote[]>();
  for (const note of input.notes) {
    const contractId = note.sourceContractId;
    if (!contractId) continue;
    const list = notesByContractId.get(contractId) ?? [];
    list.push({
      sourceInvoiceId: note.sourceInvoiceId,
      status: note.status,
      fundingStatus: note.fundingStatus,
      servicingStatus: note.servicingStatus,
      invoiceSnapshot: note.invoiceSnapshot,
    });
    notesByContractId.set(contractId, list);
  }

  const availableByInvoiceId = new Map<string, number | null>();
  for (const invoice of input.targetInvoices) {
    const contractId = invoice.contractId;
    if (!contractId || !remainingByContractId.has(contractId)) {
      availableByInvoiceId.set(invoice.id, null);
      continue;
    }
    availableByInvoiceId.set(
      invoice.id,
      availableFacilityFeeToReserve({
        remaining: remainingByContractId.get(contractId) ?? 0,
        invoices: invoicesByContractId.get(contractId) ?? [],
        notes: notesByContractId.get(contractId) ?? [],
        excludeInvoiceId: invoice.id,
      })
    );
  }
  return availableByInvoiceId;
}

export function remainingByContractIdFromContracts(
  contracts: FacilityFeeAvailableContract[]
): Map<string, number> {
  const remaining = new Map<string, number>();
  for (const contract of contracts) {
    remaining.set(contract.id, resolveFacilityFeeBalance(contract.contractDetails).remaining);
  }
  return remaining;
}

export function reservationInvoicesFromContracts(
  contracts: FacilityFeeAvailableContract[]
): FacilityFeeAvailableReservationInvoice[] {
  return contracts.flatMap((contract) =>
    contract.invoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      offerDetails: invoice.offerDetails,
      contractId: contract.id,
    }))
  );
}

export function attachFacilityFeeAvailableToReserve<
  T extends { id: string; contract_id?: string | null },
>(
  invoices: T[],
  availableByInvoiceId: Map<string, number | null>
): Array<T & { facilityFeeAvailableToReserve: number | null }> {
  return invoices.map((invoice) => ({
    ...invoice,
    facilityFeeAvailableToReserve: availableByInvoiceId.get(invoice.id) ?? null,
  }));
}

export type FacilityFeeAvailableToReserveDb = Pick<Prisma.TransactionClient, "contract" | "note">;

export async function loadFacilityFeeAvailableByInvoiceId(
  db: FacilityFeeAvailableToReserveDb,
  invoices: Array<{ id: string; contract_id?: string | null }>,
  applicationContractId?: string | null
): Promise<Map<string, number | null>> {
  const contractIds = [
    ...new Set(
      [applicationContractId, ...invoices.map((invoice) => invoice.contract_id)].filter(
        (id): id is string => Boolean(id)
      )
    ),
  ];
  if (contractIds.length === 0) {
    return new Map(invoices.map((invoice) => [invoice.id, null]));
  }
  const [contracts, notes] = await Promise.all([
    db.contract.findMany({
      where: { id: { in: contractIds } },
      select: {
        id: true,
        contract_details: true,
        invoices: { select: { id: true, status: true, offer_details: true } },
      },
    }),
    db.note.findMany({
      where: { source_contract_id: { in: contractIds } },
      select: {
        source_contract_id: true,
        source_invoice_id: true,
        status: true,
        funding_status: true,
        servicing_status: true,
        invoice_snapshot: true,
      },
    }),
  ]);
  const mappedContracts = contracts.map((contract) => ({
    id: contract.id,
    contractDetails: contract.contract_details,
    invoices: contract.invoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      offerDetails: invoice.offer_details,
    })),
  }));
  return mapFacilityFeeAvailableToReserveByInvoiceId({
    targetInvoices: invoices.map((invoice) => ({
      id: invoice.id,
      contractId: invoice.contract_id ?? null,
    })),
    remainingByContractId: remainingByContractIdFromContracts(mappedContracts),
    reservationInvoices: reservationInvoicesFromContracts(mappedContracts),
    notes: notes.map((note) => ({
      sourceInvoiceId: note.source_invoice_id,
      sourceContractId: note.source_contract_id,
      status: note.status,
      fundingStatus: note.funding_status,
      servicingStatus: note.servicing_status,
      invoiceSnapshot: note.invoice_snapshot,
    })),
  });
}
