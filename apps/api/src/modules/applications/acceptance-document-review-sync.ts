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
