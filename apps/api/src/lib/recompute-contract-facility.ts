import {
  computeContractCapacitySnapshot,
  type ContractCapacitySnapshot,
} from "./contract-facility";
import { mapInvoicesWithNotes, storedCapacityFromContract } from "./refresh-contract-facility";

export const CONTRACT_CAPACITY_RECOMPUTE_WHERE = {
  OR: [{ status: { in: ["APPROVED", "AMENDMENT_REQUESTED"] } }, { invoices: { some: {} } }],
} as const;

export type RecomputeCapacityContract = {
  id: string;
  status: string;
  display_reference?: string | null;
  contract_details: unknown;
  approved_facility?: unknown;
  utilized_facility?: unknown;
  pending_facility?: unknown;
  repaid_facility?: unknown;
  available_facility?: unknown;
  lifetime_cap?: unknown;
  lifetime_used?: unknown;
  lifetime_remaining?: unknown;
};

export type CapacityRecomputeOverLimit = {
  id: string;
  ref: string;
  availableFacility: number;
  lifetimeRemaining: number;
};

export type CapacityRecomputeReport = {
  dryRun: boolean;
  scanned: number;
  wrote: number;
  overLimit: CapacityRecomputeOverLimit[];
  rows: Array<{
    id: string;
    ref: string;
    status: string;
    invoiceCount: number;
    before: ContractCapacitySnapshot;
    after: ContractCapacitySnapshot;
  }>;
};

export function collectCapacityOverLimitRows(
  rows: Array<{ id: string; ref: string; availableFacility: number; lifetimeRemaining: number }>
): CapacityRecomputeOverLimit[] {
  return rows.filter((row) => row.availableFacility < 0 || row.lifetimeRemaining < 0);
}

export async function recomputeContractCapacitySnapshots(options: {
  dryRun: boolean;
  listContracts: () => Promise<RecomputeCapacityContract[]>;
  loadSiblings: (contractId: string) => Promise<{
    invoices: Array<{
      id: string;
      status: string;
      details: unknown;
      offer_details: unknown;
    }>;
    notes: Array<{
      source_invoice_id: string | null;
      status: string;
      servicing_status?: string | null;
      funding_status?: string | null;
      funded_amount?: unknown;
      target_amount?: unknown;
    }>;
  }>;
  persist: (contractId: string) => Promise<void>;
}): Promise<CapacityRecomputeReport> {
  const contracts = await options.listContracts();
  const rows: CapacityRecomputeReport["rows"] = [];
  let wrote = 0;

  for (const contract of contracts) {
    const before = storedCapacityFromContract(contract);
    const { invoices, notes } = await options.loadSiblings(contract.id);
    const after = computeContractCapacitySnapshot(
      contract.status,
      contract.contract_details as Record<string, unknown> | null,
      mapInvoicesWithNotes(
        invoices,
        notes.map((note) => ({
          source_invoice_id: note.source_invoice_id,
          status: note.status,
          servicing_status: note.servicing_status ?? "",
          funding_status: note.funding_status ?? "",
          funded_amount: note.funded_amount ?? 0,
          target_amount: note.target_amount ?? 0,
        }))
      )
    );
    rows.push({
      id: contract.id,
      ref: contract.display_reference ?? contract.id,
      status: contract.status,
      invoiceCount: invoices.length,
      before,
      after,
    });
    if (!options.dryRun) {
      await options.persist(contract.id);
      wrote += 1;
    }
  }

  return {
    dryRun: options.dryRun,
    scanned: contracts.length,
    wrote,
    overLimit: collectCapacityOverLimitRows(
      rows.map((row) => ({
        id: row.id,
        ref: row.ref,
        availableFacility: row.after.availableFacility,
        lifetimeRemaining: row.after.lifetimeRemaining,
      }))
    ),
    rows,
  };
}

export async function listContractsForCapacityRecompute(db: {
  contract: {
    findMany: (args: {
      where: typeof CONTRACT_CAPACITY_RECOMPUTE_WHERE;
      select: Record<string, boolean>;
      orderBy: { display_reference: "asc" };
    }) => Promise<RecomputeCapacityContract[]>;
  };
}): Promise<RecomputeCapacityContract[]> {
  return db.contract.findMany({
    where: CONTRACT_CAPACITY_RECOMPUTE_WHERE,
    select: {
      id: true,
      status: true,
      display_reference: true,
      contract_details: true,
      approved_facility: true,
      utilized_facility: true,
      pending_facility: true,
      repaid_facility: true,
      available_facility: true,
      lifetime_cap: true,
      lifetime_used: true,
      lifetime_remaining: true,
    },
    orderBy: { display_reference: "asc" },
  });
}
