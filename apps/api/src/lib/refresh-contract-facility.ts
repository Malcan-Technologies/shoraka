import type { Prisma, PrismaClient } from "@prisma/client";
import {
  computeContractFacilitySnapshot,
  facilitySnapshotToDetailsPatch,
  parseFacilityJsonAmount,
  toFacilityNoteOccupancy,
  type ContractFacilitySnapshot,
  type InvoiceForFacilityRefresh,
} from "./contract-facility";
import { prisma } from "./prisma";
import type { AuditRequestContext } from "./audit/context";
import {
  APPLICATION_AUDIT_TARGET_TYPE,
  writeApplicationAuditLog,
} from "../modules/applications/audit/writer";

type ContractFacilityDb = PrismaClient | Prisma.TransactionClient;

export type FacilityOccupancyReason =
  | "INVOICE_ACCEPTED"
  | "FUNDING_CLOSED"
  | "FUNDING_FAILED"
  | "NOTE_REPAID";

export type FacilityOccupancyAudit = {
  context: AuditRequestContext;
  reason: FacilityOccupancyReason;
  applicationId?: string | null;
  noteId?: string | null;
  invoiceId?: string | null;
};

function mapInvoicesWithNotes(
  invoices: Array<{
    id: string;
    status: string;
    details: unknown;
    offer_details: unknown;
  }>,
  notes: Array<{
    source_invoice_id: string | null;
    status: string;
    servicing_status: string;
    funding_status: string;
    funded_amount: unknown;
    target_amount: unknown;
  }>
): InvoiceForFacilityRefresh[] {
  const noteByInvoiceId = new Map<string, ReturnType<typeof toFacilityNoteOccupancy>>();
  for (const note of notes) {
    if (!note.source_invoice_id) continue;
    noteByInvoiceId.set(note.source_invoice_id, toFacilityNoteOccupancy(note));
  }
  return invoices.map((invoice) => ({
    status: invoice.status,
    details: (invoice.details as Record<string, unknown> | null) ?? null,
    offer_details: (invoice.offer_details as Record<string, unknown> | null) ?? null,
    note: noteByInvoiceId.get(invoice.id) ?? null,
  }));
}

function storedOccupancy(cd: Record<string, unknown> | null): ContractFacilitySnapshot {
  return {
    approvedFacility: parseFacilityJsonAmount(cd?.approved_facility) ?? 0,
    utilizedFacility: parseFacilityJsonAmount(cd?.utilized_facility) ?? 0,
    pendingFacility: parseFacilityJsonAmount(cd?.pending_facility) ?? 0,
    repaidFacility: parseFacilityJsonAmount(cd?.repaid_facility) ?? 0,
    availableFacility: parseFacilityJsonAmount(cd?.available_facility) ?? 0,
  };
}

function occupancyMateriallyChanged(
  before: ContractFacilitySnapshot,
  after: ContractFacilitySnapshot
): boolean {
  return (
    before.utilizedFacility !== after.utilizedFacility ||
    before.availableFacility !== after.availableFacility ||
    before.repaidFacility !== after.repaidFacility
  );
}

async function recordFacilityOccupancyAudit(
  db: ContractFacilityDb,
  input: {
    contractId: string;
    applicationId: string | null;
    before: ContractFacilitySnapshot;
    after: ContractFacilitySnapshot;
    audit: FacilityOccupancyAudit;
  }
): Promise<void> {
  if (!occupancyMateriallyChanged(input.before, input.after)) return;
  if (!input.applicationId) return;

  await writeApplicationAuditLog(
    {
      eventType: "CONTRACT_FACILITY_OCCUPANCY_UPDATED",
      context: input.audit.context,
      applicationId: input.applicationId,
      targetType: APPLICATION_AUDIT_TARGET_TYPE.CONTRACT,
      targetId: input.contractId,
      metadata: {
        reason: input.audit.reason,
        contract_id: input.contractId,
        note_id: input.audit.noteId ?? null,
        invoice_id: input.audit.invoiceId ?? null,
        before: {
          utilized_facility: input.before.utilizedFacility,
          available_facility: input.before.availableFacility,
          repaid_facility: input.before.repaidFacility,
        },
        after: {
          utilized_facility: input.after.utilizedFacility,
          available_facility: input.after.availableFacility,
          repaid_facility: input.after.repaidFacility,
          pending_facility: input.after.pendingFacility,
        },
      },
    },
    db
  );
}

/**
 * Recompute revolving occupancy and persist approved / utilized / available / pending / repaid
 * on contract_details. Safe to call with a Prisma transaction client.
 */
export async function refreshContractFacilityValues(
  contractId: string,
  db: ContractFacilityDb = prisma,
  audit?: FacilityOccupancyAudit
): Promise<ContractFacilitySnapshot | null> {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: { invoices: true },
  });
  if (!contract) return null;

  const invoiceIds = contract.invoices.map((invoice) => invoice.id);
  const notes =
    invoiceIds.length === 0
      ? []
      : await db.note.findMany({
          where: { source_invoice_id: { in: invoiceIds } },
          select: {
            source_invoice_id: true,
            status: true,
            servicing_status: true,
            funding_status: true,
            funded_amount: true,
            target_amount: true,
          },
        });

  const cd = contract.contract_details as Record<string, unknown> | null;
  const before = storedOccupancy(cd && typeof cd === "object" ? cd : null);
  const snapshot = computeContractFacilitySnapshot(
    contract.status,
    cd,
    mapInvoicesWithNotes(contract.invoices, notes)
  );
  await db.contract.update({
    where: { id: contractId },
    data: {
      contract_details: {
        ...(cd && typeof cd === "object" ? cd : {}),
        ...facilitySnapshotToDetailsPatch(snapshot),
      } as Prisma.InputJsonValue,
    },
  });

  if (audit) {
    await recordFacilityOccupancyAudit(db, {
      contractId,
      applicationId: audit.applicationId ?? contract.originating_application_id,
      before,
      after: snapshot,
      audit,
    });
  }

  return snapshot;
}

export async function refreshContractFacilityForNote(
  note: {
    source_contract_id?: string | null;
    source_application_id?: string | null;
    source_invoice_id?: string | null;
    id?: string;
  },
  db: ContractFacilityDb = prisma,
  audit?: Omit<FacilityOccupancyAudit, "noteId" | "invoiceId" | "applicationId"> &
    Partial<Pick<FacilityOccupancyAudit, "noteId" | "invoiceId" | "applicationId">>
): Promise<void> {
  if (!note.source_contract_id) return;
  await refreshContractFacilityValues(
    note.source_contract_id,
    db,
    audit
      ? {
          ...audit,
          noteId: audit.noteId ?? note.id ?? null,
          invoiceId: audit.invoiceId ?? note.source_invoice_id ?? null,
          applicationId: audit.applicationId ?? note.source_application_id ?? null,
        }
      : undefined
  );
}
