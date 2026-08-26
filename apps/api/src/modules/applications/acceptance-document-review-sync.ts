/**
 * Pure helpers for acceptance document review ↔ offer phase alignment.
 * Item reject/reset follows the same rules as supporting documents (derived section status).
 */

/** Docs + people must all be APPROVED; any AMENDMENT_REQUESTED flags CHANGES_REQUESTED. */
export function resolveAcceptanceReviewApprovalGate(input: {
  docKeys: readonly string[];
  partyKeys: readonly string[];
  statusByKey: ReadonlyMap<string, string>;
}): { hasAmendment: boolean; allApproved: boolean } {
  const requiredKeys = [...input.docKeys, ...input.partyKeys];
  const hasAmendment = requiredKeys.some(
    (key) => input.statusByKey.get(key) === "AMENDMENT_REQUESTED"
  );
  const allApproved =
    requiredKeys.length > 0 &&
    requiredKeys.every((key) => input.statusByKey.get(key) === "APPROVED");
  return { hasAmendment, allApproved };
}
