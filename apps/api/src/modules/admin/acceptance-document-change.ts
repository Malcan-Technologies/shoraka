import { AppError } from "../../lib/http/error-handler";

/** Item review keys look like `acceptance_documents:<index>:<slug>`. */
export function isAcceptanceDocumentItemId(itemId: string): boolean {
  return itemId.startsWith("acceptance_documents:");
}

/** Underwriting pending-amendments must not accept acceptance section or item scopes. */
export function isAcceptanceDocumentsAmendmentQueueScope(
  scope: "section" | "item",
  scopeKey: string
): boolean {
  if (scope === "section") return scopeKey === "acceptance_documents";
  return scopeKey.startsWith("acceptance_documents:");
}

const ACCEPTANCE_DOCUMENT_CHANGE_ALLOWED_STATUSES = new Set(["PENDING", "APPROVED"]);

/** Request change while the acceptance document row is pending or already approved. */
export function assertAcceptanceDocumentChangeRequestAllowed(
  currentStatus: string | null | undefined
): void {
  const status = (currentStatus ?? "PENDING").toUpperCase();
  if (!ACCEPTANCE_DOCUMENT_CHANGE_ALLOWED_STATUSES.has(status)) {
    throw new AppError(
      400,
      "INVALID_ACTION",
      "Request change is only allowed for pending or approved acceptance documents"
    );
  }
}

/**
 * Notify once when the offer phase first enters CHANGES_REQUESTED.
 * Further Request change clicks while already in that phase stay silent (generic inbox copy).
 */
export function shouldNotifyAcceptanceDocumentChanges(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined
): boolean {
  return previousStatus !== "CHANGES_REQUESTED" && nextStatus === "CHANGES_REQUESTED";
}
