/**
 * Supporting-documents product workflow: category keys, facility-lock config,
 * and drawdown inheritance helpers.
 */

import { getStepKeyFromStepId } from "./application-steps";

export const SUPPORTING_DOC_CATEGORY_KEYS = [
  "financial_docs",
  "legal_docs",
  "compliance_docs",
  "others",
] as const;

export type SupportingDocCategoryKey = (typeof SUPPORTING_DOC_CATEGORY_KEYS)[number];

export const SUPPORTING_DOC_CATEGORY_LABELS: Record<SupportingDocCategoryKey, string> = {
  financial_docs: "Financial Docs",
  legal_docs: "Legal Docs",
  compliance_docs: "Compliance Docs",
  others: "Others",
};

/** Legacy array form. Prefer `category_settings` so this is never scanned as a document list. */
export const FACILITY_LOCKED_CATEGORIES_KEY = "facility_locked_categories";

/** Per-category settings. Object (not array) so it cannot be rendered as a document group. */
export const SUPPORTING_DOC_CATEGORY_SETTINGS_KEY = "category_settings";

export const FACILITY_LOCKED_SUPPORTING_DOCUMENTS_MESSAGE =
  "This document was approved on the facility application and cannot be changed";

export type SupportingDocumentReviewItem = {
  item_type: string;
  item_id: string;
  status: string;
};

export function isSupportingDocCategoryKey(key: string): key is SupportingDocCategoryKey {
  return (SUPPORTING_DOC_CATEGORY_KEYS as readonly string[]).includes(key);
}

export function supportingDocCategoryKeyFromLabel(label: string): SupportingDocCategoryKey | null {
  const normalized = label.trim().toLowerCase();
  if (isSupportingDocCategoryKey(normalized)) return normalized;
  const spaced = normalized.replace(/_/g, " ");
  for (const key of SUPPORTING_DOC_CATEGORY_KEYS) {
    if (SUPPORTING_DOC_CATEGORY_LABELS[key].toLowerCase() === normalized) return key;
    if (key.replace(/_/g, " ") === spaced) return key;
  }
  return null;
}

export function getSupportingDocumentsStepConfigFromWorkflow(
  workflow: unknown
): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  for (const step of workflow) {
    if (!step || typeof step !== "object") continue;
    const id = typeof (step as { id?: unknown }).id === "string" ? (step as { id: string }).id : "";
    if (!id || getStepKeyFromStepId(id) !== "supporting_documents") continue;
    const config = (step as { config?: unknown }).config;
    if (config && typeof config === "object" && !Array.isArray(config)) {
      return config as Record<string, unknown>;
    }
    return null;
  }
  return null;
}

export function parseFacilityLockedCategories(config: unknown): SupportingDocCategoryKey[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) return [];
  const root = config as Record<string, unknown>;
  const seen = new Set<SupportingDocCategoryKey>();
  const keys: SupportingDocCategoryKey[] = [];

  const push = (key: string) => {
    if (!isSupportingDocCategoryKey(key) || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  const settings = root[SUPPORTING_DOC_CATEGORY_SETTINGS_KEY];
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    for (const [key, value] of Object.entries(settings as Record<string, unknown>)) {
      const row =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
      if (row?.lock_at_facility === true) push(key);
    }
  }

  const legacy = root[FACILITY_LOCKED_CATEGORIES_KEY];
  if (Array.isArray(legacy)) {
    for (const value of legacy) {
      if (typeof value === "string") push(value);
    }
  }

  return keys;
}

export function serializeFacilityLockedCategorySettings(
  lockedKeys: readonly string[]
): Record<string, { lock_at_facility: true }> | undefined {
  const settings: Record<string, { lock_at_facility: true }> = {};
  for (const key of lockedKeys) {
    if (!isSupportingDocCategoryKey(key)) continue;
    settings[key] = { lock_at_facility: true };
  }
  return Object.keys(settings).length > 0 ? settings : undefined;
}

export function getFacilityLockedCategoriesFromWorkflow(workflow: unknown): SupportingDocCategoryKey[] {
  return parseFacilityLockedCategories(getSupportingDocumentsStepConfigFromWorkflow(workflow));
}

/** Document-list entries in workflow config (known supporting-document keys only). */
export function supportingDocumentCategoryEntries(
  config: unknown
): Array<[SupportingDocCategoryKey, unknown[]]> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return [];
  const entries: Array<[SupportingDocCategoryKey, unknown[]]> = [];
  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    if (!isSupportingDocCategoryKey(key) || !Array.isArray(value)) continue;
    entries.push([key, value]);
  }
  return entries;
}

export function parseSupportingDocumentItemCategoryKey(itemId: string): SupportingDocCategoryKey | null {
  const match = itemId
    .trim()
    .match(/^supporting_documents:(?:doc:)?(financial_docs|legal_docs|compliance_docs|others):/i);
  if (!match) return null;
  const key = match[1]?.toLowerCase();
  return key && isSupportingDocCategoryKey(key) ? key : null;
}

export function isFacilityLockedSupportingDocumentItem(
  itemId: string,
  lockedKeys: readonly string[]
): boolean {
  if (lockedKeys.length === 0) return false;
  const category = parseSupportingDocumentItemCategoryKey(itemId);
  return category != null && lockedKeys.includes(category);
}

type SupportingCategoryPayload = { name: string; documents: unknown[] };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function unwrapSupportingDocumentCategories(data: unknown): SupportingCategoryPayload[] {
  const root = asRecord(data);
  if (!root) return [];
  const nested = asRecord(root.supporting_documents);
  const raw = nested ?? root;
  const categories = raw.categories;
  if (!Array.isArray(categories)) return [];
  return categories
    .map((cat) => {
      const row = asRecord(cat);
      if (!row) return null;
      const name = typeof row.name === "string" ? row.name : "";
      const documents = Array.isArray(row.documents) ? row.documents : [];
      return { name, documents };
    })
    .filter((cat): cat is SupportingCategoryPayload => cat != null);
}

function collectS3KeysFromDocument(doc: unknown, into: Set<string>): void {
  const row = asRecord(doc);
  if (!row) return;
  const file = asRecord(row.file);
  if (typeof file?.s3_key === "string" && file.s3_key) into.add(file.s3_key);
  const files = row.files;
  if (!Array.isArray(files)) return;
  for (const entry of files) {
    const rec = asRecord(entry);
    if (typeof rec?.s3_key === "string" && rec.s3_key) into.add(rec.s3_key);
  }
}

export function collectSupportingDocumentS3Keys(
  data: unknown,
  categoryKeys?: readonly string[]
): string[] {
  const keys = new Set<string>();
  const filter = categoryKeys && categoryKeys.length > 0 ? new Set(categoryKeys) : null;
  for (const category of unwrapSupportingDocumentCategories(data)) {
    const categoryKey = supportingDocCategoryKeyFromLabel(category.name);
    if (filter && (categoryKey == null || !filter.has(categoryKey))) continue;
    for (const doc of category.documents) {
      collectS3KeysFromDocument(doc, keys);
    }
  }
  return [...keys];
}

function categoryFingerprint(category: SupportingCategoryPayload | undefined): string {
  const keys = new Set<string>();
  for (const doc of category?.documents ?? []) {
    collectS3KeysFromDocument(doc, keys);
  }
  return [...keys].sort().join("|");
}

function findCategory(
  categories: SupportingCategoryPayload[],
  categoryKey: string
): SupportingCategoryPayload | undefined {
  const expected = isSupportingDocCategoryKey(categoryKey)
    ? SUPPORTING_DOC_CATEGORY_LABELS[categoryKey]
    : categoryKey;
  return categories.find((cat) => {
    const key = supportingDocCategoryKeyFromLabel(cat.name);
    return key === categoryKey || cat.name === expected;
  });
}

export function mergeFacilityLockedSupportingDocuments(input: {
  drawdownDocs: unknown;
  originDocs: unknown;
  lockedKeys: readonly string[];
}): unknown {
  if (input.lockedKeys.length === 0) return input.drawdownDocs;
  const originCategories = unwrapSupportingDocumentCategories(input.originDocs);
  const drawdownCategories = unwrapSupportingDocumentCategories(input.drawdownDocs);
  const next = drawdownCategories.map((cat) => cloneJson(cat));

  for (const lockedKey of input.lockedKeys) {
    const originCat = findCategory(originCategories, lockedKey);
    if (!originCat) continue;
    const cloned = cloneJson(originCat);
    const existingIndex = next.findIndex((cat) => {
      const key = supportingDocCategoryKeyFromLabel(cat.name);
      return key === lockedKey;
    });
    if (existingIndex >= 0) {
      next[existingIndex] = cloned;
    } else {
      next.push(cloned);
    }
  }

  const drawdownRoot = asRecord(input.drawdownDocs);
  const nested = drawdownRoot ? asRecord(drawdownRoot.supporting_documents) : null;
  if (nested) {
    return {
      ...drawdownRoot,
      supporting_documents: { ...nested, categories: next },
    };
  }
  if (drawdownRoot && Array.isArray(drawdownRoot.categories)) {
    return { ...drawdownRoot, categories: next };
  }
  return { categories: next };
}

export function stripFacilityLockedSupportingDocuments(
  data: unknown,
  lockedKeys: readonly string[]
): unknown {
  if (lockedKeys.length === 0 || !data || typeof data !== "object") return data;
  const locked = new Set(lockedKeys);
  const root = asRecord(data);
  if (!root) return data;
  const nested = asRecord(root.supporting_documents);
  const payload = nested ?? root;
  if (!Array.isArray(payload.categories)) return data;
  const categories = (payload.categories as unknown[]).filter((cat) => {
    const row = asRecord(cat);
    const key = supportingDocCategoryKeyFromLabel(typeof row?.name === "string" ? row.name : "");
    return key == null || !locked.has(key);
  });
  const nextPayload = { ...payload, categories };
  if (nested) {
    return { ...root, supporting_documents: nextPayload };
  }
  return nextPayload;
}

/** True when the issuer payload changes a locked category versus the facility application. Omitted locked categories are not a change. */
export function facilityLockedSupportingDocumentsChanged(
  incomingDocs: unknown,
  originDocs: unknown,
  lockedKeys: readonly string[]
): boolean {
  if (lockedKeys.length === 0) return false;
  const incoming = unwrapSupportingDocumentCategories(incomingDocs);
  const origin = unwrapSupportingDocumentCategories(originDocs);
  for (const lockedKey of lockedKeys) {
    const incomingCat = findCategory(incoming, lockedKey);
    if (!incomingCat) continue;
    if (categoryFingerprint(incomingCat) !== categoryFingerprint(findCategory(origin, lockedKey))) {
      return true;
    }
  }
  return false;
}

export function mergeFacilityLockedSupportingDocumentReviewItems(
  drawdownItems: readonly SupportingDocumentReviewItem[] | null | undefined,
  originItems: readonly SupportingDocumentReviewItem[] | null | undefined,
  lockedKeys: readonly string[]
): SupportingDocumentReviewItem[] {
  const locked = new Set(lockedKeys);
  const base = (drawdownItems ?? []).filter((item) => {
    const category = parseSupportingDocumentItemCategoryKey(item.item_id);
    return category == null || !locked.has(category);
  });
  const inherited = (originItems ?? []).filter((item) => {
    const category = parseSupportingDocumentItemCategoryKey(item.item_id);
    return category != null && locked.has(category);
  });
  return [...base, ...inherited];
}
