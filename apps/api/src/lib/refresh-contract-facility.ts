import type { Prisma, PrismaClient } from "@prisma/client";
import {
  CAPACITY_SNAPSHOT_VERSION,
  CAPACITY_SNAPSHOT_VERSION_KEY,
  hasCompletedCapacitySnapshot,
} from "@cashsouk/types";
import {
  assertCapacityWrite,
  assertProposedCapacitySnapshot,
} from "./contract-capacity-errors";
import {
  capacitySnapshotToColumnValues,
  capacitySnapshotsEqual,
  computeContractCapacitySnapshot,
  emptyCapacitySnapshot,
  facilitySnapshotToDetailsPatch,
  parseFacilityJsonAmount,
  toFacilityNoteOccupancy,
  type ContractCapacitySnapshot,
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

export type RefreshContractCapacityOptions = {
  /**
   * When true, assert the recomputed snapshot against the previous live snapshot
   * (or stored occupancy when a live previous was not provided).
   * When a snapshot is passed, assert that proposed write and that it matches the recompute.
   */
  assertProposed?: boolean | ContractCapacitySnapshot;
  /** Live occupancy computed before sibling writes. Never use stored available as previous. */
  previousSnapshot?: ContractCapacitySnapshot;
  /** Skip FOR UPDATE when the caller already holds the contract lock in this transaction. */
  skipLock?: boolean;
};

export type ApplyContractCapacityOptions = {
  audit?: FacilityOccupancyAudit;
  /** Default true. Release/decrease writes still pass grandfathering. */
  assertWrite?: boolean;
};

const NOTE_CAPACITY_SELECT = {
  source_invoice_id: true,
  status: true,
  servicing_status: true,
  funding_status: true,
  listing_status: true,
  funded_amount: true,
  target_amount: true,
} as const;

function isInteractiveClient(db: ContractFacilityDb): db is PrismaClient {
  return typeof (db as PrismaClient).$transaction === "function";
}

export async function lockContractRow(
  db: Prisma.TransactionClient,
  contractId: string
): Promise<void> {
  await db.$queryRaw`SELECT id FROM contracts WHERE id = ${contractId} FOR UPDATE`;
}

export function mapInvoicesWithNotes(
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
    listing_status?: string | null;
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

function amountFromColumnOrJson(
  column: unknown,
  jsonValue: unknown,
  typedAuthoritative = false
): number {
  const fromColumn = parseFacilityJsonAmount(column);
  if (typedAuthoritative && fromColumn != null) return fromColumn;
  if (fromColumn != null && fromColumn !== 0) return fromColumn;
  const fromJson = parseFacilityJsonAmount(jsonValue);
  if (fromJson != null) return fromJson;
  return fromColumn ?? 0;
}

function isJsonAmountPresent(value: unknown): boolean {
  return parseFacilityJsonAmount(value) != null;
}

function typedNonZero(column: unknown): boolean {
  const amount = parseFacilityJsonAmount(column);
  return amount != null && amount !== 0;
}

function contractDetailsRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolveStoredLifetimeCapacity(
  contract: {
    lifetime_cap?: unknown;
    lifetime_used?: unknown;
    lifetime_remaining?: unknown;
  },
  cd: Record<string, unknown> | null,
  contractValue: number
): { lifetimeCap: number; lifetimeUsed: number; lifetimeRemaining: number } {
  const marked = hasCompletedCapacitySnapshot(cd);
  const lifetimeUsed = amountFromColumnOrJson(contract.lifetime_used, cd?.lifetime_used, marked);
  if (marked) {
    return {
      lifetimeCap: amountFromColumnOrJson(contract.lifetime_cap, cd?.lifetime_cap, true),
      lifetimeUsed,
      lifetimeRemaining: amountFromColumnOrJson(contract.lifetime_remaining, cd?.lifetime_remaining, true),
    };
  }
  const lifetimeCap = contractValue > 0 ? contractValue : amountFromColumnOrJson(contract.lifetime_cap, cd?.lifetime_cap);
  const storedRemaining = amountFromColumnOrJson(contract.lifetime_remaining, cd?.lifetime_remaining);
  return {
    lifetimeCap,
    lifetimeUsed,
    // Migration defaults remaining to 0; a negative value is a real over-limit snapshot.
    lifetimeRemaining: storedRemaining < 0 ? storedRemaining : lifetimeCap - lifetimeUsed,
  };
}

export function storedCapacityFromContract(contract: {
  approved_facility?: unknown;
  utilized_facility?: unknown;
  pending_facility?: unknown;
  repaid_facility?: unknown;
  available_facility?: unknown;
  lifetime_cap?: unknown;
  lifetime_used?: unknown;
  lifetime_remaining?: unknown;
  contract_details?: unknown;
}): ContractCapacitySnapshot {
  const cd = contractDetailsRecord(contract.contract_details);
  const marked = hasCompletedCapacitySnapshot(cd);
  const contractValue = parseFacilityJsonAmount(cd?.value) ?? parseFacilityJsonAmount(cd?.contract_value) ?? 0;
  const lifetime = resolveStoredLifetimeCapacity(contract, cd, contractValue);
  return {
    approvedFacility: amountFromColumnOrJson(contract.approved_facility, cd?.approved_facility, marked),
    utilizedFacility: amountFromColumnOrJson(contract.utilized_facility, cd?.utilized_facility, marked),
    pendingFacility: amountFromColumnOrJson(contract.pending_facility, cd?.pending_facility, marked),
    repaidFacility: amountFromColumnOrJson(contract.repaid_facility, cd?.repaid_facility, marked),
    availableFacility: amountFromColumnOrJson(contract.available_facility, cd?.available_facility, marked),
    lifetimeCap: lifetime.lifetimeCap,
    lifetimeUsed: lifetime.lifetimeUsed,
    lifetimeRemaining: lifetime.lifetimeRemaining,
    requestedFacility: parseFacilityJsonAmount(cd?.financing) ?? parseFacilityJsonAmount(cd?.facility_applied) ?? 0,
    contractValue,
  };
}

function occupancyMateriallyChanged(
  before: ContractCapacitySnapshot | ContractFacilitySnapshot,
  after: ContractCapacitySnapshot | ContractFacilitySnapshot
): boolean {
  const beforeLifetime = before as Partial<ContractCapacitySnapshot>;
  const afterLifetime = after as Partial<ContractCapacitySnapshot>;
  return (
    before.utilizedFacility !== after.utilizedFacility ||
    before.availableFacility !== after.availableFacility ||
    before.repaidFacility !== after.repaidFacility ||
    before.pendingFacility !== after.pendingFacility ||
    beforeLifetime.lifetimeUsed !== afterLifetime.lifetimeUsed ||
    beforeLifetime.lifetimeRemaining !== afterLifetime.lifetimeRemaining
  );
}

const OCCUPANCY_OVERLAY_KEYS = new Set([
  "approved_facility",
  "utilized_facility",
  "pending_facility",
  "repaid_facility",
  "available_facility",
]);

function overlayCapacityDetailsPatch(
  contract: {
    approved_facility?: unknown;
    utilized_facility?: unknown;
    pending_facility?: unknown;
    repaid_facility?: unknown;
    available_facility?: unknown;
  },
  existing: Record<string, unknown>,
  snapshot: ContractCapacitySnapshot
): Record<string, number> {
  const patch = facilitySnapshotToDetailsPatch(snapshot);
  if (hasCompletedCapacitySnapshot(existing)) return patch;

  const filtered: Record<string, number> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!OCCUPANCY_OVERLAY_KEYS.has(key)) {
      filtered[key] = value;
      continue;
    }
    const column = contract[key as keyof typeof contract];
    if (isJsonAmountPresent(existing[key]) || typedNonZero(column)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export function overlayStoredCapacityOnContractDetails<
  T extends {
    contract_details?: unknown;
    approved_facility?: unknown;
    utilized_facility?: unknown;
    pending_facility?: unknown;
    repaid_facility?: unknown;
    available_facility?: unknown;
    lifetime_cap?: unknown;
    lifetime_used?: unknown;
    lifetime_remaining?: unknown;
  },
>(contract: T): T {
  const snapshot = storedCapacityFromContract(contract);
  const existing = contractDetailsRecord(contract.contract_details) ?? {};
  return {
    ...contract,
    contract_details: {
      ...existing,
      ...overlayCapacityDetailsPatch(contract, existing, snapshot),
    },
  };
}

export function overlayStoredCapacityOnApplicationContract<T>(application: T): T {
  if (!application || typeof application !== "object") return application;
  const contract = (application as { contract?: unknown }).contract;
  if (!contract || typeof contract !== "object") return application;
  return {
    ...application,
    contract: overlayStoredCapacityOnContractDetails(
      contract as Parameters<typeof overlayStoredCapacityOnContractDetails>[0]
    ),
  };
}

export type ContractCapacityReadSource = {
  id?: string;
  status?: string;
  contract_details?: unknown;
  approved_facility?: unknown;
  utilized_facility?: unknown;
  pending_facility?: unknown;
  repaid_facility?: unknown;
  available_facility?: unknown;
  lifetime_cap?: unknown;
  lifetime_used?: unknown;
  lifetime_remaining?: unknown;
};

const LIVE_CAPACITY_INVOICE_SELECT = {
  id: true,
  contract_id: true,
  status: true,
  details: true,
  offer_details: true,
} as const;

export type ContractCapacityReadDb = {
  invoice: {
    findMany: (args: {
      where: { contract_id: { in: string[] } };
      select: typeof LIVE_CAPACITY_INVOICE_SELECT;
    }) => Promise<
      Array<{
        id: string;
        contract_id: string | null;
        status: string;
        details: unknown;
        offer_details: unknown;
      }>
    >;
  };
  note: {
    findMany: (args: {
      where: { source_invoice_id: { in: string[] } };
      select: typeof NOTE_CAPACITY_SELECT;
    }) => Promise<
      Array<{
        source_invoice_id: string | null;
        status: string;
        servicing_status: string;
        funding_status: string;
        listing_status?: string | null;
        funded_amount: unknown;
        target_amount: unknown;
      }>
    >;
  };
};

function isUnmarkedCapacityContract(contract: { contract_details?: unknown }): boolean {
  return !hasCompletedCapacitySnapshot(contractDetailsRecord(contract.contract_details));
}

function overlayComputedCapacityOnContractDetails<T extends ContractCapacityReadSource>(
  contract: T,
  snapshot: ContractCapacitySnapshot
): T {
  const existing = contractDetailsRecord(contract.contract_details) ?? {};
  return {
    ...contract,
    contract_details: {
      ...existing,
      ...facilitySnapshotToDetailsPatch(snapshot),
    },
  };
}

async function loadUnmarkedContractCapacitySources(
  db: ContractCapacityReadDb,
  contractIds: string[]
): Promise<{
  invoices: Array<{
    id: string;
    contract_id: string | null;
    status: string;
    details: unknown;
    offer_details: unknown;
  }>;
  notes: Array<{
    source_invoice_id: string | null;
    status: string;
    servicing_status: string;
    funding_status: string;
    listing_status?: string | null;
    funded_amount: unknown;
    target_amount: unknown;
  }>;
}> {
  const ids = [...new Set(contractIds.filter(Boolean))];
  if (ids.length === 0) return { invoices: [], notes: [] };
  const invoices = await db.invoice.findMany({
    where: { contract_id: { in: ids } },
    select: LIVE_CAPACITY_INVOICE_SELECT,
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const notes =
    invoiceIds.length === 0
      ? []
      : await db.note.findMany({
          where: { source_invoice_id: { in: invoiceIds } },
          select: NOTE_CAPACITY_SELECT,
        });
  return { invoices, notes };
}

/**
 * Issuer GET overlay. Marked snapshots stay on the fast typed/JSON path.
 * Unmarked contracts recompute from sibling invoices + notes and overlay the
 * snapshot onto the response only — no persist, no row locks.
 */
export async function overlayReadCapacityOnContracts<T extends ContractCapacityReadSource>(
  db: ContractCapacityReadDb,
  contracts: T[]
): Promise<T[]> {
  const unmarkedIds = [
    ...new Set(
      contracts
        .filter((contract) => Boolean(contract?.id) && isUnmarkedCapacityContract(contract))
        .map((contract) => contract.id as string)
    ),
  ];
  const sources =
    unmarkedIds.length === 0
      ? { invoices: [] as Awaited<ReturnType<typeof loadUnmarkedContractCapacitySources>>["invoices"], notes: [] }
      : await loadUnmarkedContractCapacitySources(db, unmarkedIds);
  const invoicesByContract = new Map<string, typeof sources.invoices>();
  for (const invoice of sources.invoices) {
    if (!invoice.contract_id) continue;
    const list = invoicesByContract.get(invoice.contract_id) ?? [];
    list.push(invoice);
    invoicesByContract.set(invoice.contract_id, list);
  }

  return contracts.map((contract) => {
    if (!isUnmarkedCapacityContract(contract) || !contract.id) {
      return overlayStoredCapacityOnContractDetails(contract);
    }
    const snapshot = computeContractCapacitySnapshot(
      contract.status ?? "",
      contractDetailsRecord(contract.contract_details),
      mapInvoicesWithNotes(invoicesByContract.get(contract.id) ?? [], sources.notes)
    );
    return overlayComputedCapacityOnContractDetails(contract, snapshot);
  });
}

export async function overlayReadCapacityOnApplicationContract<T>(
  db: ContractCapacityReadDb,
  application: T
): Promise<T> {
  if (!application || typeof application !== "object") return application;
  const contract = (application as { contract?: ContractCapacityReadSource | null }).contract;
  if (!contract || typeof contract !== "object") return application;
  const [overlaid] = await overlayReadCapacityOnContracts(db, [contract]);
  return { ...application, contract: overlaid };
}

export async function overlayReadCapacityOnApplications<T>(
  db: ContractCapacityReadDb,
  applications: T[]
): Promise<T[]> {
  const contracts: ContractCapacityReadSource[] = [];
  const seen = new Set<string>();
  for (const application of applications) {
    if (!application || typeof application !== "object") continue;
    const contract = (application as { contract?: ContractCapacityReadSource | null }).contract;
    if (!contract || typeof contract !== "object" || !contract.id || seen.has(contract.id)) continue;
    seen.add(contract.id);
    contracts.push(contract);
  }
  const overlaid = await overlayReadCapacityOnContracts(db, contracts);
  const byId = new Map<string, ContractCapacityReadSource>();
  for (const contract of overlaid) {
    if (contract.id) byId.set(contract.id, contract);
  }
  return applications.map((application) => {
    if (!application || typeof application !== "object") return application;
    const contract = (application as { contract?: ContractCapacityReadSource | null }).contract;
    if (!contract?.id) return application;
    const next = byId.get(contract.id);
    return next ? { ...application, contract: next } : application;
  });
}

export function persistCapacitySnapshotData(
  existingDetails: Record<string, unknown> | null,
  snapshot: ContractCapacitySnapshot
): Prisma.ContractUpdateInput {
  return {
    ...capacitySnapshotToColumnValues(snapshot),
    contract_details: {
      ...(existingDetails ?? {}),
      ...facilitySnapshotToDetailsPatch(snapshot),
      [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
    } as Prisma.InputJsonValue,
  };
}

export async function loadContractCapacitySiblings(
  db: ContractFacilityDb,
  contractId: string
): Promise<{
  invoices: Array<{
    id: string;
    status: string;
    details: unknown;
    offer_details: unknown;
  }>;
  notes: Array<{
    source_invoice_id: string | null;
    status: string;
    servicing_status: string;
    funding_status: string;
    listing_status: string;
    funded_amount: unknown;
    target_amount: unknown;
  }>;
}> {
  const invoices = await db.invoice.findMany({
    where: { contract_id: contractId },
    select: { id: true, status: true, details: true, offer_details: true },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const notes =
    invoiceIds.length === 0
      ? []
      : await db.note.findMany({
          where: { source_invoice_id: { in: invoiceIds } },
          select: NOTE_CAPACITY_SELECT,
        });
  return { invoices, notes };
}

function occupancyAuditAmounts(
  snapshot: ContractCapacitySnapshot | ContractFacilitySnapshot
): {
  utilized_facility: number;
  available_facility: number;
  repaid_facility: number;
  pending_facility: number;
  lifetime_used: number;
  lifetime_remaining: number;
} {
  const lifetime = snapshot as Partial<ContractCapacitySnapshot>;
  return {
    utilized_facility: snapshot.utilizedFacility,
    available_facility: snapshot.availableFacility,
    repaid_facility: snapshot.repaidFacility,
    pending_facility: snapshot.pendingFacility,
    lifetime_used: lifetime.lifetimeUsed ?? 0,
    lifetime_remaining: lifetime.lifetimeRemaining ?? 0,
  };
}

async function recordFacilityOccupancyAudit(
  db: ContractFacilityDb,
  input: {
    contractId: string;
    applicationId: string | null;
    before: ContractCapacitySnapshot | ContractFacilitySnapshot;
    after: ContractCapacitySnapshot | ContractFacilitySnapshot;
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
        before: occupancyAuditAmounts(input.before),
        after: occupancyAuditAmounts(input.after),
      },
    },
    db
  );
}

export async function computeLiveCapacitySnapshot(
  tx: Prisma.TransactionClient,
  contractId: string
): Promise<{
  snapshot: ContractCapacitySnapshot;
} | null> {
  const contract = await tx.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) return null;

  const { invoices, notes } = await loadContractCapacitySiblings(tx, contractId);
  const cd = contract.contract_details as Record<string, unknown> | null;
  return {
    snapshot: computeContractCapacitySnapshot(
      contract.status,
      cd,
      mapInvoicesWithNotes(invoices, notes)
    ),
  };
}

function uniqueSortedContractIds(contractIds: Array<string | null | undefined>): string[] {
  return [...new Set(contractIds.filter((id): id is string => Boolean(id)))].sort();
}

async function runInSameTransaction<T>(
  db: ContractFacilityDb,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (isInteractiveClient(db)) {
    return db.$transaction((tx) => work(tx));
  }
  return work(db);
}

/**
 * Lock the contract, snapshot live occupancy, run sibling writes, then recompute
 * and persist in the same transaction. Never starts a nested interactive transaction.
 */
export async function applyContractCapacityChange<T>(
  contractId: string,
  db: ContractFacilityDb,
  mutate: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: ApplyContractCapacityOptions
): Promise<{ result: T; snapshot: ContractCapacitySnapshot | null }> {
  return runInSameTransaction(db, async (tx) => {
    await lockContractRow(tx, contractId);
    const previous = await computeLiveCapacitySnapshot(tx, contractId);
    const result = await mutate(tx);
    const snapshot = await refreshContractFacilityInTx(contractId, tx, options?.audit, {
      assertProposed: options?.assertWrite ?? true,
      previousSnapshot: previous?.snapshot,
      skipLock: true,
    });
    return { result, snapshot };
  });
}

/**
 * Lock multiple contracts in sorted id order, then mutate and persist each snapshot.
 */
export async function applyContractCapacityChanges<T>(
  contractIds: Array<string | null | undefined>,
  db: ContractFacilityDb,
  mutate: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: ApplyContractCapacityOptions
): Promise<{
  result: T;
  snapshots: Array<{ contractId: string; snapshot: ContractCapacitySnapshot | null }>;
}> {
  const ids = uniqueSortedContractIds(contractIds);
  if (ids.length === 0) {
    return runInSameTransaction(db, async (tx) => ({
      result: await mutate(tx),
      snapshots: [],
    }));
  }
  if (ids.length === 1) {
    const { result, snapshot } = await applyContractCapacityChange(ids[0]!, db, mutate, options);
    return { result, snapshots: [{ contractId: ids[0]!, snapshot }] };
  }

  return runInSameTransaction(db, async (tx) => {
    const previousById = new Map<string, ContractCapacitySnapshot>();
    for (const contractId of ids) {
      await lockContractRow(tx, contractId);
      const previous = await computeLiveCapacitySnapshot(tx, contractId);
      if (previous) previousById.set(contractId, previous.snapshot);
    }
    const result = await mutate(tx);
    const snapshots: Array<{ contractId: string; snapshot: ContractCapacitySnapshot | null }> = [];
    for (const contractId of ids) {
      snapshots.push({
        contractId,
        snapshot: await refreshContractFacilityInTx(contractId, tx, options?.audit, {
          assertProposed: options?.assertWrite ?? true,
          previousSnapshot: previousById.get(contractId),
          skipLock: true,
        }),
      });
    }
    return { result, snapshots };
  });
}

async function refreshContractFacilityInTx(
  contractId: string,
  tx: Prisma.TransactionClient,
  audit?: FacilityOccupancyAudit,
  options?: RefreshContractCapacityOptions
): Promise<ContractCapacitySnapshot | null> {
  if (!options?.skipLock) {
    await lockContractRow(tx, contractId);
  }

  const contract = await tx.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) return null;

  const { invoices, notes } = await loadContractCapacitySiblings(tx, contractId);
  const cd = contract.contract_details as Record<string, unknown> | null;
  const stored = storedCapacityFromContract(contract);
  const before = options?.previousSnapshot ?? stored;
  const snapshot = computeContractCapacitySnapshot(
    contract.status,
    cd,
    mapInvoicesWithNotes(invoices, notes)
  );

  const proposed = options?.assertProposed;
  if (proposed === true) {
    assertCapacityWrite(before, snapshot, contractId);
  } else if (proposed) {
    assertProposedCapacitySnapshot(proposed, before, contractId);
    if (!capacitySnapshotsEqual(proposed, snapshot)) {
      assertCapacityWrite(before, snapshot, contractId);
    }
  }

  await tx.contract.update({
    where: { id: contractId },
    data: persistCapacitySnapshotData(cd && typeof cd === "object" ? cd : null, snapshot),
  });

  if (audit) {
    await recordFacilityOccupancyAudit(tx, {
      contractId,
      applicationId: audit.applicationId ?? contract.originating_application_id,
      before,
      after: snapshot,
      audit,
    });
  }

  return snapshot;
}

/**
 * Lock the contract, recompute revolving + lifetime occupancy from sibling invoices
 * and notes, and persist typed columns plus contract_details JSON.
 * Safe to call with a Prisma transaction client.
 */
export async function refreshContractFacilityValues(
  contractId: string,
  db: ContractFacilityDb = prisma,
  audit?: FacilityOccupancyAudit,
  options?: RefreshContractCapacityOptions
): Promise<ContractCapacitySnapshot | null> {
  if (isInteractiveClient(db)) {
    return db.$transaction((tx) => refreshContractFacilityInTx(contractId, tx, audit, options));
  }
  return refreshContractFacilityInTx(contractId, db, audit, options);
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
    Partial<Pick<FacilityOccupancyAudit, "noteId" | "invoiceId" | "applicationId">>,
  options?: RefreshContractCapacityOptions
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
      : undefined,
    options
  );
}

export { emptyCapacitySnapshot };
