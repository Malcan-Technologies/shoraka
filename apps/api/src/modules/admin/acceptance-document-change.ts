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

/** Request change is only allowed while the acceptance document row is still pending. */
export function assertAcceptanceDocumentChangeRequestAllowed(
  currentStatus: string | null | undefined
): void {
  const status = (currentStatus ?? "PENDING").toUpperCase();
  if (status !== "PENDING") {
    throw new AppError(
      400,
      "INVALID_ACTION",
      "Request change is only allowed for pending acceptance documents"
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
