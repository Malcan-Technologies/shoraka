/**
 * Shared utilities for application review scope keys and amendment grouping.
 * Single source of truth for scope_key format and section derivation.
 *
 * Scope key format:
 * - Section: scope_key = section id (e.g. "supporting_documents")
 * - Supporting documents item: scope_key = "supporting_documents:<category>:<index>:<name>"
 * - Invoice item: scope_key = "invoice_details:<index>:<invoice_number>"
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
  if (scopeKey.startsWith("supporting_documents:")) {
    return "supporting_documents";
  }
  if (scopeKey.startsWith("invoice_details:")) {
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

/**
 * Split item scope_key into itemType and itemId.
 * The full string is itemId; itemType is "document" or "invoice" respectively.
 */
export function parseItemScopeKey(scopeKey: string): {
  itemType: string;
  itemId: string;
} {
  if (scopeKey.startsWith("supporting_documents:")) {
    return { itemType: "document", itemId: scopeKey };
  }
  if (scopeKey.startsWith("invoice_details:")) {
    return { itemType: "invoice", itemId: scopeKey };
  }
  const colonIdx = scopeKey.indexOf(":");
  return {
    itemType: colonIdx >= 0 ? scopeKey.slice(0, colonIdx) : scopeKey,
    itemId: colonIdx >= 0 ? scopeKey.slice(colonIdx + 1) : "",
  };
}

/**
 * Get the document/invoice item id from scope_key for frontend matching.
 */
export function getItemIdFromScopeKey(scopeKey: string): string {
  return scopeKey;
}

/**
 * Check if a scope_key refers to a document item.
 */
export function isDocumentScopeKey(scopeKey: string): boolean {
  return scopeKey.startsWith("supporting_documents:");
}

/** Get section sort index for ordering. */
export function getSectionSortIndex(sectionKey: string): number {
  const i = REVIEW_SECTION_ORDER.indexOf(sectionKey as ReviewSection);
  return i === -1 ? REVIEW_SECTION_ORDER.length : i;
}

/** Title-case a slug for display (e.g. "p2p_declaration" -> "P2P Declaration"). */
function toDisplayName(slug: string): string {
  return slug
    .replace(/_/g, " ")
    .split(" ")
    .map((word) =>
      word.length > 1 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
}

/**
 * Extract human-readable display name from item scope_key.
 * - Invoice: "Invoice 12345"
 * - Document: "P2P Declaration" (slug part, title-cased)
 * Supports legacy formats: document:..., invoice:... (from migrations).
 */
export function getItemDisplayNameFromScopeKey(scopeKey: string): string {
  if (!scopeKey || typeof scopeKey !== "string") return "Item";

  const parts = scopeKey.split(":");
  const lastPart = parts[parts.length - 1];

  if (scopeKey.startsWith("invoice_details:")) {
    return lastPart ? `Invoice ${lastPart}` : "Invoice";
  }
  if (scopeKey.startsWith("supporting_documents:")) {
    if (lastPart) return toDisplayName(lastPart);
  }
  return "Item";
}

/**
 * Parser for strict scope_key format described in the Amendment Lifecycle spec.
 *
 * Allowed formats:
 * - Tab-level: "contract_details"
 * - Field-level no category: "tab:index:field"
 * - Field-level with category: "tab:category:index:field" (tab must be "supporting_documents")
 */
export type ParsedScopeKey =
  | { kind: "TAB"; tab: string; raw: string }
  | { kind: "FIELD"; tab: string; index: number; field: string; raw: string; category?: string };

const ALLOWED_TABS = [
  "contract_details",
  "invoice_details",
  "supporting_documents",
  "business_details",
] as const;

export function parseScopeKey(raw: string): ParsedScopeKey {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Invalid scope_key: must be a non-empty string");
  }
  const parts = raw.split(":");

  if (parts.length === 1) {
    const tab = parts[0];
    if (!ALLOWED_TABS.includes(tab as any)) {
      throw new Error(`Invalid tab-level scope_key: ${tab}`);
    }
    return { kind: "TAB", tab, raw };
  }

  if (parts.length === 3) {
    const [tab, idxStr, field] = parts;
    if (!tab || !idxStr || !field) {
      throw new Error(`Invalid field-level scope_key: ${raw}`);
    }
    const index = Number(idxStr);
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Invalid index in scope_key: ${idxStr}`);
    }
    return { kind: "FIELD", tab, index, field, raw };
  }

  if (parts.length === 4) {
    const [tab, category, idxStr, field] = parts;
    if (tab !== "supporting_documents") {
      throw new Error(`Invalid tab for category scope_key: ${tab}`);
    }
    if (!category || !idxStr || !field) {
      throw new Error(`Invalid category field-level scope_key: ${raw}`);
    }
    const index = Number(idxStr);
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Invalid index in scope_key: ${idxStr}`);
    }
    return { kind: "FIELD", tab, category, index, field, raw };
  }

  throw new Error(`Invalid scope_key format: ${raw}`);
}

/**
 * ParsedAmendScope - best-effort mapping from admin scope_key to workflow identity.
 * workflowId: best-effort identifier for the workflow step (usually the tab id or prefix).
 * kind: 'tab' | 'supporting_doc' | 'invoice' | 'contract' | 'unknown'
 * entityId: optional id for item-level scopes (invoice id, document id, etc.)
 */
export type ParsedAmendScope = {
  workflowId: string;
  kind: "tab" | "supporting_doc" | "invoice" | "contract" | "unknown";
  entityId?: string;
};

/**
 * parseAmendScopeKey - stable helper that extracts a workflowId and entity identity from admin scope_key format.
 * This is best-effort and must not require admin schema changes.
 */
export function parseAmendScopeKey(scopeKey: string): ParsedAmendScope {
  if (!scopeKey || typeof scopeKey !== "string") {
    throw new Error("Invalid scopeKey");
  }

  let parsed: ParsedAmendScope;

  // Tab-level: exact matches to allowed tabs
  if (ALLOWED_TABS.includes(scopeKey as any)) {
    parsed = { workflowId: scopeKey, kind: "tab" };
  } else if (isDocumentScopeKey(scopeKey)) {
    const itemId = getItemIdFromScopeKey(scopeKey);
    parsed = { workflowId: "supporting_documents", kind: "supporting_doc", entityId: itemId };
  } else if (scopeKey.startsWith("invoice:") || scopeKey.startsWith("invoice_details")) {
    const parts = scopeKey.split(":");
    if (parts.length >= 2 && parts[1]) {
      parsed = { workflowId: "invoice_details", kind: "invoice", entityId: parts.slice(1).join(":") };
    } else {
      parsed = { workflowId: "invoice_details", kind: "invoice" };
    }
  } else if (scopeKey.startsWith("contract") || scopeKey === "contract_details") {
    parsed = { workflowId: "contract_details", kind: "contract" };
  } else {
    try {
      const scopeParsed = parseScopeKey(scopeKey);
      if (scopeParsed.kind === "TAB") {
        parsed = { workflowId: scopeParsed.tab, kind: "tab" };
      } else if (scopeParsed.kind === "FIELD") {
        parsed = { workflowId: scopeParsed.tab, kind: scopeParsed.tab === "invoice_details" ? "invoice" : "unknown", entityId: String(scopeParsed.index) };
      } else {
        parsed = { workflowId: "unknown", kind: "unknown" };
      }
    } catch {
      parsed = { workflowId: "unknown", kind: "unknown" };
    }
  }

  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.debug("[AMENDMENT][PARSE] scopeKey:", scopeKey, "parsed:", parsed);
  }

  return parsed;
}
