/** Written onto `contract_details` when persist/refresh/recompute stores a dual-ledger snapshot. */
export const CAPACITY_SNAPSHOT_VERSION = 1;
export const CAPACITY_SNAPSHOT_VERSION_KEY = "capacity_snapshot_version" as const;

/**
 * Typed capacity columns default to 0 before backfill. A completed snapshot is
 * present only when persist wrote this marker — not when a typed column is 0.
 */
export function hasCompletedCapacitySnapshot(
  contractDetails: Record<string, unknown> | null | undefined
): boolean {
  if (!contractDetails) return false;
  const version = contractDetails[CAPACITY_SNAPSHOT_VERSION_KEY];
  return typeof version === "number" && Number.isInteger(version) && version >= CAPACITY_SNAPSHOT_VERSION;
}

/** Invoice statuses that occupy contract allocation from submission onward. */
export const LIFETIME_COUNT_INVOICE_STATUSES = [
  "SUBMITTED",
  "AMENDMENT_REQUESTED",
  "OFFER_SENT",
  "APPROVED",
] as const;

/** Draft and release statuses never occupy contract allocation. */
export const LIFETIME_RELEASE_INVOICE_STATUSES = [
  "DRAFT",
  "REJECTED",
  "WITHDRAWN",
  "OFFER_EXPIRED",
] as const;

export function invoiceStatusCountsTowardLifetime(status: string | null | undefined): boolean {
  const value = String(status ?? "").toUpperCase();
  return (LIFETIME_COUNT_INVOICE_STATUSES as readonly string[]).includes(value);
}

export type ConservativeMigrationWindowLifetimeInvoice = {
  status?: string | null;
  faceValue?: number | null;
};

/**
 * Invoice-face sum for unmarked pre-backfill rows.
 *
 * Review payloads do not include note release or settlement state, so
 * `conservativeMigrationWindowLifetimeUsed` cannot drop FAILED_FUNDING /
 * CANCELLED notes or keep repaid allocation from notes. It does not invent
 * released-note data. Marked snapshots remain the exact source of truth.
 */
export function conservativeMigrationWindowLifetimeUsed(
  invoices: ConservativeMigrationWindowLifetimeInvoice[]
): number {
  let used = 0;
  for (const invoice of invoices) {
    if (!invoiceStatusCountsTowardLifetime(invoice.status)) continue;
    const face = invoice.faceValue;
    if (typeof face === "number" && Number.isFinite(face) && face > 0) {
      used += face;
    }
  }
  return used;
}

export function conservativeMigrationWindowLifetimeRemaining(
  lifetimeCap: number,
  lifetimeUsed: number
): number {
  return lifetimeCap - lifetimeUsed;
}
