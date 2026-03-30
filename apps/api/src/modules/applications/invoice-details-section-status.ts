import type { ReviewStepStatus } from "@cashsouk/types";

/**
 * Derives invoice_details section status from per-invoice review item rows.
 * - Any WITHDRAWN → WITHDRAWN
 * - Any PENDING → PENDING
 * - All APPROVED → APPROVED
 * - All REJECTED → REJECTED
 * - Else any AMENDMENT_REQUESTED → AMENDMENT_REQUESTED
 * - Else any OFFER_SENT → OFFER_SENT
 * - Else PENDING
 */
export function computeInvoiceDetailsSectionStatus(
  invoiceKeys: readonly string[],
  invoiceItemRows: readonly { item_id: string; status: string }[]
): ReviewStepStatus {
  if (invoiceKeys.length === 0) {
    return "PENDING";
  }
  const byId = new Map(invoiceItemRows.map((r) => [r.item_id, r.status]));
  const statuses = invoiceKeys.map((k) => byId.get(k) ?? "PENDING");

  if (statuses.some((s) => s === "WITHDRAWN")) {
    return "WITHDRAWN";
  }
  if (statuses.some((s) => s === "PENDING")) {
    return "PENDING";
  }
  if (statuses.every((s) => s === "APPROVED")) {
    return "APPROVED";
  }
  if (statuses.every((s) => s === "REJECTED")) {
    return "REJECTED";
  }
  if (statuses.some((s) => s === "AMENDMENT_REQUESTED")) {
    return "AMENDMENT_REQUESTED";
  }
  if (statuses.some((s) => s === "OFFER_SENT")) {
    return "OFFER_SENT";
  }
  return "PENDING";
}
