import type { ReviewStepStatus } from "@cashsouk/types";

/**
 * Derives supporting_documents section status from per-document item rows.
 * Rules:
 * - Any item REJECTED → section REJECTED
 * - Else any item PENDING → section PENDING
 * - Else all APPROVED → section APPROVED
 * - Else any AMENDMENT_REQUESTED (all items decided, not all approved) → AMENDMENT_REQUESTED
 */
export function computeSupportingDocumentsSectionStatus(
  docKeys: readonly string[],
  documentItemRows: readonly { item_id: string; status: string }[]
): ReviewStepStatus {
  if (docKeys.length === 0) {
    return "PENDING";
  }
  const byId = new Map(documentItemRows.map((r) => [r.item_id, r.status]));
  const statuses = docKeys.map((k) => byId.get(k) ?? "PENDING");

  if (statuses.some((s) => s === "REJECTED")) {
    return "REJECTED";
  }
  if (statuses.some((s) => s === "PENDING")) {
    return "PENDING";
  }
  if (statuses.every((s) => s === "APPROVED")) {
    return "APPROVED";
  }
  if (statuses.some((s) => s === "AMENDMENT_REQUESTED")) {
    return "AMENDMENT_REQUESTED";
  }
  return "PENDING";
}
