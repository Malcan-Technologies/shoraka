/**
 * Shared utilities for application review scope keys and amendment grouping.
 * Single source of truth for scope_key format and section derivation.
 *
 * Scope key format:
 * - Section: scope_key = section id (e.g. "supporting_documents")
 * - Item: scope_key = "itemType:itemId" (e.g. "document:doc:legal_docs:0:Deed_of_Assignment")
 *   - itemId may contain colons; split only on first colon
 */

/** Canonical section order for grouping and display. */
export const REVIEW_SECTION_ORDER = [
  "financial",
  "company_details",
  "business_details",
  "supporting_documents",
  "contract_details",
  "invoice_details",
] as const;

export type ReviewSection = (typeof REVIEW_SECTION_ORDER)[number];

/** Get the parent section for an item scope_key. */
export function getSectionForScopeKey(scopeKey: string): ReviewSection {
  if (scopeKey.startsWith("document:") || scopeKey.startsWith("doc:")) {
    return "supporting_documents";
  }
  if (scopeKey.startsWith("invoice:")) {
    return "invoice_details";
  }
  return "supporting_documents";
}

/**
 * Get the section for a pending amendment (section or item scope).
 * For section scope, scope_key is the section id.
 * For item scope, scope_key is "itemType:itemId" - derive section from prefix.
 */
export function getSectionForPendingAmendment(
  scope: string,
  scopeKey: string
): ReviewSection {
  if (scope === "section") {
    return scopeKey as ReviewSection;
  }
  return getSectionForScopeKey(scopeKey);
}

/** Split item scope_key into itemType and itemId. ItemId may contain colons. */
export function parseItemScopeKey(scopeKey: string): {
  itemType: string;
  itemId: string;
} {
  const colonIdx = scopeKey.indexOf(":");
  return {
    itemType: colonIdx >= 0 ? scopeKey.slice(0, colonIdx) : scopeKey,
    itemId: colonIdx >= 0 ? scopeKey.slice(colonIdx + 1) : "",
  };
}

/** Build canonical item scope_key in "itemType:itemId" format. */
export function buildItemScopeKey(itemType: string, itemId: string): string {
  return `${itemType}:${itemId}`;
}

/**
 * Get the document/invoice item id from scope_key for frontend matching.
 * scope_key = "document:doc:cat:0:slug" → "doc:cat:0:slug"
 */
export function getItemIdFromScopeKey(scopeKey: string): string {
  if (scopeKey.startsWith("document:")) {
    return scopeKey.slice("document:".length);
  }
  if (scopeKey.startsWith("doc:")) {
    return scopeKey.slice("doc:".length);
  }
  if (scopeKey.startsWith("invoice:")) {
    return scopeKey.slice("invoice:".length);
  }
  return scopeKey;
}

/**
 * Check if a scope_key refers to a document item.
 */
export function isDocumentScopeKey(scopeKey: string): boolean {
  return scopeKey.startsWith("document:") || scopeKey.startsWith("doc:");
}

/** Get section sort index for ordering. */
export function getSectionSortIndex(sectionKey: string): number {
  const i = REVIEW_SECTION_ORDER.indexOf(sectionKey as ReviewSection);
  return i === -1 ? REVIEW_SECTION_ORDER.length : i;
}

/** Extract human-readable display name from item scope_key (slug part for documents). */
export function getItemDisplayNameFromScopeKey(scopeKey: string): string {
  if (scopeKey.startsWith("invoice:")) {
    return "Invoice";
  }
  if (isDocumentScopeKey(scopeKey)) {
    const itemId = getItemIdFromScopeKey(scopeKey);
    const parts = itemId.split(":");
    const slug = parts[parts.length - 1];
    if (slug) {
      return slug.replace(/_/g, " ");
    }
  }
  return "Item";
}
