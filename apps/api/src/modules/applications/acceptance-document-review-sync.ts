/**
 * Pure helpers for acceptance document review ↔ offer phase alignment.
 * Item reject/reset follows the same rules as supporting documents (derived section status).
 */

export function hasAnyRejectedAcceptanceDocumentItems(
  docKeys: readonly string[],
  statusByKey: ReadonlyMap<string, string>
): boolean {
  return docKeys.some((key) => statusByKey.get(key) === "REJECTED");
}

/** True when an acceptance-doc rejection withdrawal can be unwound (Set to Pending / approve). */
export function shouldRestoreWithdrawnOfferForAcceptanceReview(params: {
  entityStatus: string;
  withdrawReason: string | null | undefined;
  offerAcceptanceStatus: string | null | undefined;
  hasRejectedItems: boolean;
}): boolean {
  if (params.hasRejectedItems) {
    return false;
  }
  if (params.entityStatus !== "WITHDRAWN") {
    return false;
  }
  if (params.withdrawReason !== "OFFER_REJECTED") {
    return false;
  }
  return params.offerAcceptanceStatus === "REJECTED";
}
