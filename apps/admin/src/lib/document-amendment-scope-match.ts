/**
 * SECTION: Match stored amendment scope_key to a supporting-doc row key
 * WHY: scope_key includes a title slug; resubmit may change title — still same slot if category + index match.
 * INPUT: stored scope_key from DB, item.key from buildCategoryGroups
 * OUTPUT: boolean
 * WHERE USED: SupportingDocumentsComparisonLayout
 */

export function documentAmendmentScopeMatchesRow(storedScopeKey: string, docItemKey: string): boolean {
  if (storedScopeKey === docItemKey) return true;
  const a = storedScopeKey.split(":");
  const b = docItemKey.split(":");
  if (
    a.length >= 3 &&
    b.length >= 3 &&
    a[0] === "supporting_documents" &&
    b[0] === "supporting_documents" &&
    a[1] === b[1] &&
    a[2] === b[2]
  ) {
    return true;
  }
  return false;
}
