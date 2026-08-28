import { AppError } from "../../lib/http/error-handler";
import {
  findAuthorizedPartyForReviewItemId,
  isAuthorizedRepresentativesItemId,
  type AuthorizedPartiesSnapshot,
} from "@cashsouk/types";

/** Item review keys look like `acceptance_documents:<index>:<slug>`. */
export function isAcceptanceDocumentItemId(itemId: string): boolean {
  return itemId.startsWith("acceptance_documents:");
}

export function isAcceptanceHubReviewItem(itemType: string, itemId: string): boolean {
  if (itemType === "document") return isAcceptanceDocumentItemId(itemId);
  if (itemType === "authorized_representatives") {
    return isAuthorizedRepresentativesItemId(itemId);
  }
  return false;
}

/** Underwriting pending-amendments must not accept acceptance section or item scopes. */
export function isAcceptanceDocumentsAmendmentQueueScope(
  scope: "section" | "item",
  scopeKey: string
): boolean {
  if (scope === "section") return scopeKey === "acceptance_documents";
  return (
    scopeKey.startsWith("acceptance_documents:") ||
    scopeKey.startsWith("authorized_representatives:")
  );
}

const ACCEPTANCE_DOCUMENT_CHANGE_ALLOWED_STATUSES = new Set(["PENDING", "APPROVED"]);

/** Request change while the acceptance document or party list is pending or already approved. */
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

export function assertAuthorizedRepresentativeChangeRequestAllowed(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  itemId: string
): void {
  const party = findAuthorizedPartyForReviewItemId(snapshot, itemId);
  if (!party) {
    throw new AppError(
      400,
      "INVALID_ITEM",
      "Representative list not found on this offer."
    );
  }
  if (party.entity_kind === "INDIVIDUAL_GUARANTOR") {
    throw new AppError(
      400,
      "INVALID_ACTION",
      "Individual guarantor identity is changed on Business & Guarantor Details, not here."
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
