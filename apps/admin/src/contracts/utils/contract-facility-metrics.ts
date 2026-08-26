import { formatCurrency } from "@cashsouk/config";
import {
  hasCompletedCapacitySnapshot,
  resolveFacilityFeeBalance,
  resolveFacilityFeeUpfront,
  roundNoteMoney,
} from "@cashsouk/types";

/**
 * Facility amounts arrive from two places: `approvedFacility` is a typed number
 * on the payload, while utilization only exists inside the `contractDetails`
 * JSON blob, where issuers may have stored "1,250,000" or "RM 1,250,000.00".
 */
export function parseFacilityAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export type ContractFacilityMetrics = {
  approved: number;
  utilized: number;
  pending: number;
  /** May be negative when reserved or live financing exceeds the approved line. */
  available: number;
  lifetimeCap: number;
  lifetimeUsed: number;
  /** May be negative on grandfathered over-limit rows. */
  lifetimeRemaining: number;
  occupied: number;
  /** Occupied credit (utilized + reserved) vs approved. */
  utilizationPercent: number | null;
  allocationPercent: number | null;
  isCreditOverLimit: boolean;
  isAllocationOverLimit: boolean;
  isOverLimit: boolean;
};

export function getContractUtilizationProgressClass(
  percent: number | null,
  hasFacility: boolean
) {
  if (!hasFacility || percent == null) return "bg-muted";
  if (percent > 100) return "bg-muted [&>div]:bg-status-rejected-text";
  if (percent >= 100) return "bg-muted [&>div]:bg-status-success-text";
  return "[&>div]:bg-status-submitted-text";
}

export function getContractUtilizationAccentClass(
  percent: number | null,
  hasFacility: boolean
) {
  if (!hasFacility || percent == null) return undefined;
  if (percent > 100) return "text-status-rejected-text";
  if (percent >= 100) return "text-status-success-text";
  return "text-status-submitted-text";
}

export function formatContractFacilityNoteCount(noteCount: number): string {
  if (noteCount <= 0) return "No drawdowns have used this line of credit";
  if (noteCount === 1) return "1 drawdown has used this line of credit";
  return `${noteCount} drawdowns have used this line of credit`;
}

export type ContractFacilityFeeCollected = {
  paid: number;
  cap: number;
  display: string;
};

export function resolveContractFacilityFeeCap(
  approved: number,
  facilityFeeRatePercent: unknown
): number | null {
  const rate = parseFacilityAmount(facilityFeeRatePercent);
  if (rate == null || rate <= 0 || approved <= 0) return null;
  return roundNoteMoney(approved * (rate / 100));
}

export type ContractFacilityFeeLedger = {
  owed: number;
  charged: number;
  waived: number;
  remaining: number;
  enabled: boolean;
  disabledReason: string | null;
  waivedAtContract: boolean;
  upfrontRequested: number;
  paidTowardUpfront: number;
  upfrontOutstanding: number;
};

export function resolveContractFacilityFeeLedger(input: {
  approved: number;
  contractDetails?: Record<string, unknown> | null;
}): ContractFacilityFeeLedger {
  const details = {
    ...(input.contractDetails ?? {}),
    approved_facility: input.approved,
  };
  const balance = resolveFacilityFeeBalance(details);
  const upfront = resolveFacilityFeeUpfront(details);
  return {
    owed: balance.totalOwed,
    charged: balance.paid,
    waived: balance.waivedAmount,
    remaining: balance.remaining,
    enabled: balance.enabled,
    disabledReason: balance.disabledReason,
    waivedAtContract: balance.waived,
    upfrontRequested: upfront.upfrontAmount,
    paidTowardUpfront: roundNoteMoney(Math.min(balance.paid, upfront.upfrontAmount)),
    upfrontOutstanding: upfront.outstanding,
  };
}

export function canWaiveContractFacilityFee(ledger: ContractFacilityFeeLedger): boolean {
  return !ledger.waivedAtContract && ledger.remaining > 0;
}

export type ContractFacilityFeeWaitingNote = {
  title: string;
  description: string;
};

export function resolveContractFacilityFeeWaitingNote(
  ledger: Pick<ContractFacilityFeeLedger, "upfrontOutstanding">
): ContractFacilityFeeWaitingNote | null {
  if (ledger.upfrontOutstanding <= 0) return null;
  return {
    title: "Issuer has an unpaid upfront facility fee",
    description: `${formatCurrency(ledger.upfrontOutstanding)} is still due. Drawdowns stay locked until the issuer pays this via the payment gateway.`,
  };
}

/** Paid-to-date vs cap from the same contract_details fields the facility tab uses. */
export function resolveContractFacilityFeeCollected(input: {
  approved: number;
  facilityFeeRatePercent: unknown;
  facilityFeePaidAmount: unknown;
}): ContractFacilityFeeCollected | null {
  const paid = parseFacilityAmount(input.facilityFeePaidAmount);
  const cap = resolveContractFacilityFeeCap(input.approved, input.facilityFeeRatePercent);
  if (paid == null || cap == null) return null;
  return {
    paid,
    cap,
    display: `${formatCurrency(paid)} / ${formatCurrency(cap)} cap`,
  };
}

type ContractFacilityFields = {
  approvedFacility?: number | null;
  status?: string | null;
  contractDetails?: Record<string, unknown> | null;
  utilizedFacility?: number | null;
  pendingFacility?: number | null;
  availableFacility?: number | null;
  lifetimeCap?: number | null;
  lifetimeUsed?: number | null;
  lifetimeRemaining?: number | null;
};

function typedOrJson(typed: number | null | undefined, json: unknown, fallback = 0): number {
  if (typeof typed === "number" && Number.isFinite(typed)) return typed;
  return parseFacilityAmount(json) ?? fallback;
}

const IN_FORCE_FACILITY_STATUSES = new Set(["APPROVED", "AMENDMENT_REQUESTED"]);

/**
 * Header metrics for the contract detail page. Same JSON source as the
 * contracts list utilization column, so both surfaces agree.
 */
export function resolveContractFacilityMetrics(
  contract: ContractFacilityFields
): ContractFacilityMetrics {
  const fromPayload = parseFacilityAmount(contract.approvedFacility);
  const fromJson = parseFacilityAmount(contract.contractDetails?.approved_facility);
  const allowJsonApproved = IN_FORCE_FACILITY_STATUSES.has(String(contract.status ?? "").toUpperCase());
  const approved =
    fromPayload != null && fromPayload > 0
      ? fromPayload
      : allowJsonApproved && fromJson != null && fromJson > 0
        ? fromJson
        : fromPayload ?? fromJson ?? 0;
  const utilized = typedOrJson(
    contract.utilizedFacility,
    contract.contractDetails?.utilized_facility
  );
  const pending = typedOrJson(
    contract.pendingFacility,
    contract.contractDetails?.pending_facility
  );
  const storedAvailable = typedOrJson(
    contract.availableFacility,
    contract.contractDetails?.available_facility,
    Number.NaN
  );
  const available = Number.isFinite(storedAvailable)
    ? storedAvailable
    : approved - utilized - pending;
  const lifetimeCap = typedOrJson(
    contract.lifetimeCap,
    contract.contractDetails?.lifetime_cap
  );
  const lifetimeUsed = typedOrJson(
    contract.lifetimeUsed,
    contract.contractDetails?.lifetime_used
  );
  const storedLifetimeRemaining = typedOrJson(
    contract.lifetimeRemaining,
    contract.contractDetails?.lifetime_remaining,
    Number.NaN
  );
  const lifetimeRemaining = Number.isFinite(storedLifetimeRemaining)
    ? storedLifetimeRemaining
    : lifetimeCap - lifetimeUsed;
  const occupied = utilized + pending;
  const isCreditOverLimit = available < 0 || (approved > 0 && occupied > approved);
  const isAllocationOverLimit = lifetimeCap > 0 && lifetimeRemaining < 0;

  return {
    approved,
    utilized,
    pending,
    available,
    lifetimeCap,
    lifetimeUsed,
    lifetimeRemaining,
    occupied,
    utilizationPercent: approved > 0 ? (occupied / approved) * 100 : null,
    allocationPercent: lifetimeCap > 0 ? (lifetimeUsed / lifetimeCap) * 100 : null,
    isCreditOverLimit,
    isAllocationOverLimit,
    isOverLimit: isCreditOverLimit || isAllocationOverLimit,
  };
}

const PENDING_INVOICE_STATUSES = new Set(["SUBMITTED", "OFFER_SENT", "AMENDMENT_REQUESTED"]);

function invoiceDetailsRecord(details: unknown): Record<string, unknown> | null {
  return details && typeof details === "object" ? (details as Record<string, unknown>) : null;
}

function invoiceRequestedFinancing(details: Record<string, unknown> | null): number | null {
  const requested =
    parseFacilityAmount(details?.applied_financing) ?? parseFacilityAmount(details?.financing_amount);
  return requested != null && requested > 0 ? requested : null;
}

function invoiceCommittedAmount(invoice: {
  status?: string;
  details?: unknown;
  offer_details?: unknown;
}): number {
  const offer =
    invoice.offer_details && typeof invoice.offer_details === "object"
      ? (invoice.offer_details as Record<string, unknown>)
      : null;
  const details = invoiceDetailsRecord(invoice.details);
  const offered = parseFacilityAmount(offer?.offered_amount);
  const requested = invoiceRequestedFinancing(details);
  const status = String(invoice.status ?? "").toUpperCase();
  if (status === "OFFER_SENT") {
    if (offered != null && offered > 0) return offered;
    if (requested != null) return requested;
  } else {
    if (requested != null) return requested;
    if (offered != null && offered > 0) return offered;
  }
  const value = parseFacilityAmount(details?.value) ?? 0;
  const ratio = parseFacilityAmount(details?.financing_ratio_percent) ?? 60;
  const safeRatio = ratio > 0 ? ratio : 60;
  return value * (safeRatio / 100);
}

/** Reserved financing on submitted, amendment, and offer-sent invoices. */
export function sumPendingInvoiceFacility(
  invoices: Array<{ status?: string; details?: unknown; offer_details?: unknown }>
): number {
  let sum = 0;
  for (const invoice of invoices) {
    const status = String(invoice.status ?? "").toUpperCase();
    if (!PENDING_INVOICE_STATUSES.has(status)) continue;
    sum += invoiceCommittedAmount(invoice);
  }
  return sum;
}

/**
 * Prefer a completed pending snapshot. Marked `0` is real occupancy. Unmarked
 * typed/JSON zeros are pre-backfill defaults — fall back to the invoice sum.
 */
export function resolvePendingFacilityFromSnapshot(
  contractDetails: Record<string, unknown> | null | undefined,
  invoices: Array<{ status?: string; details?: unknown; offer_details?: unknown }>
): number {
  const stored = parseFacilityAmount(contractDetails?.pending_facility);
  if (hasCompletedCapacitySnapshot(contractDetails)) {
    if (stored != null) return stored;
    return sumPendingInvoiceFacility(invoices);
  }
  if (stored != null && stored !== 0) return stored;
  return sumPendingInvoiceFacility(invoices);
}

export type AdminReviewFacilityOccupancy = {
  pendingFacility: number;
  availableFacility: number;
};

/**
 * Invoice-review occupancy. Marked snapshots use stored available/pending
 * exactly. Unmarked rows use canonical pending fallback and reduce legacy
 * remaining credit by that pending. The current invoice stays in the sum —
 * offer preview add-back is the only add-back.
 */
export function resolveAdminReviewFacilityOccupancy(input: {
  contractDetails: Record<string, unknown> | null | undefined;
  invoices: Array<{ status?: string; details?: unknown; offer_details?: unknown }>;
  approvedFacility: number;
  utilizedFacility: number;
}): AdminReviewFacilityOccupancy {
  const pendingFacility = resolvePendingFacilityFromSnapshot(input.contractDetails, input.invoices);
  const storedAvailable = parseFacilityAmount(input.contractDetails?.available_facility);
  if (hasCompletedCapacitySnapshot(input.contractDetails)) {
    return {
      pendingFacility,
      availableFacility:
        storedAvailable != null
          ? storedAvailable
          : input.approvedFacility - input.utilizedFacility - pendingFacility,
    };
  }
  if (storedAvailable == null) {
    return {
      pendingFacility,
      availableFacility: input.approvedFacility - input.utilizedFacility - pendingFacility,
    };
  }
  const storedPending = parseFacilityAmount(input.contractDetails?.pending_facility);
  const pendingFromFallback = storedPending == null || storedPending === 0;
  return {
    pendingFacility,
    availableFacility: pendingFromFallback ? storedAvailable - pendingFacility : storedAvailable,
  };
}
