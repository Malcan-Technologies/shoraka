import { formatCurrency } from "@cashsouk/config";
import type { AdminContractDetail } from "@cashsouk/types";

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
  /** May be negative when a live draw exceeds the approved line. */
  available: number;
  /** `null` when there is no approved facility to measure utilization against. */
  utilizationPercent: number | null;
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
  return approved * (rate / 100);
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

type ContractFacilityFields = Pick<
  AdminContractDetail,
  "approvedFacility" | "contractDetails" | "status"
>;

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
  const utilized = parseFacilityAmount(contract.contractDetails?.utilized_facility) ?? 0;
  const pending = parseFacilityAmount(contract.contractDetails?.pending_facility) ?? 0;
  const storedAvailable = parseFacilityAmount(contract.contractDetails?.available_facility);

  return {
    approved,
    utilized,
    pending,
    available: storedAvailable ?? approved - utilized,
    utilizationPercent: approved > 0 ? (utilized / approved) * 100 : null,
  };
}

const PENDING_INVOICE_STATUSES = new Set(["SUBMITTED", "OFFER_SENT", "AMENDMENT_REQUESTED"]);

function invoiceCommittedAmount(invoice: {
  details?: unknown;
  offer_details?: unknown;
}): number {
  const offer =
    invoice.offer_details && typeof invoice.offer_details === "object"
      ? (invoice.offer_details as Record<string, unknown>)
      : null;
  const offered = parseFacilityAmount(offer?.offered_amount);
  if (offered != null && offered > 0) return offered;
  const details =
    invoice.details && typeof invoice.details === "object"
      ? (invoice.details as Record<string, unknown>)
      : null;
  const value = parseFacilityAmount(details?.value) ?? 0;
  const ratio = parseFacilityAmount(details?.financing_ratio_percent) ?? 60;
  const safeRatio = ratio > 0 ? ratio : 60;
  return value * (safeRatio / 100);
}

/** Display-only pending occupancy (does not reduce available). */
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
