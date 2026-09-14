import {
  collectAuthorizedRepresentativeReviewKeys,
  isAuthorizedRepresentativesItemId,
  type AuthorizedPartiesSnapshot,
} from "@cashsouk/types";

/**
 * Keep authorised-party review rows on the selected offer's snapshot.
 * Acceptance document rows stay shared (application-wide uploads).
 */
export function filterAcceptanceReviewItemsForOffer<T extends { item_id: string }>(
  reviewItems: T[],
  authorizedParties?: AuthorizedPartiesSnapshot | null
): T[] {
  const partyKeys = new Set(collectAuthorizedRepresentativeReviewKeys(authorizedParties));
  if (partyKeys.size === 0) return reviewItems;
  return reviewItems.filter((item) => {
    if (!isAuthorizedRepresentativesItemId(item.item_id)) return true;
    return partyKeys.has(item.item_id);
  });
}
