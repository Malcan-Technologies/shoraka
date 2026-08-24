const NAME_KEYS = ["title", "name", "file_name", "document_name"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function looksLikeStorageKey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.includes("\\")) return true;
  if (trimmed.includes("/") && /\.[a-z0-9]{2,8}$/i.test(trimmed)) return true;
  return false;
}

function readName(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || looksLikeStorageKey(trimmed)) return null;
    return trimmed;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const key of NAME_KEYS) {
    const candidate = record[key];
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed && !looksLikeStorageKey(trimmed)) return trimmed;
    }
  }
  return readName(record.file);
}

function pushUnique(names: string[], value: string | null): void {
  if (!value || names.includes(value)) return;
  names.push(value);
}

function collectFromFileList(value: unknown, names: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      pushUnique(names, readName(item));
    }
    return;
  }
  pushUnique(names, readName(value));
}

function collectFromDocumentRow(row: unknown, names: string[]): void {
  const record = asRecord(row);
  if (!record) {
    pushUnique(names, readName(row));
    return;
  }
  pushUnique(names, readName(record));
  collectFromFileList(record.files, names);
  collectFromFileList(record.file, names);
}

function collectFromCategoryBuckets(root: Record<string, unknown>, names: string[]): void {
  const categoryKeys = ["financial_docs", "legal_docs", "compliance_docs", "others"];
  for (const key of categoryKeys) {
    const bucket = root[key];
    if (bucket == null) continue;
    const rows = Array.isArray(bucket) ? bucket : [bucket];
    for (const row of rows) collectFromDocumentRow(row, names);
  }
}

function collectFromCategories(categories: unknown, names: string[]): void {
  if (!Array.isArray(categories)) return;
  for (const category of categories) {
    const record = asRecord(category);
    if (!record) continue;
    const docs = Array.isArray(record.documents) ? record.documents : [];
    for (const doc of docs) collectFromDocumentRow(doc, names);
  }
}

function collectSupportingDocuments(value: unknown, names: string[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const row of value) collectFromDocumentRow(row, names);
    return;
  }
  const root = asRecord(value);
  if (!root) return;
  if (root.supporting_documents != null && root.supporting_documents !== value) {
    collectSupportingDocuments(root.supporting_documents, names);
  }
  collectFromCategories(root.categories, names);
  collectFromCategoryBuckets(root, names);
}

function collectAcceptanceDocuments(value: unknown, names: string[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const row of value) collectFromDocumentRow(row, names);
    return;
  }
  const root = asRecord(value);
  if (!root) return;
  const list = Array.isArray(root.documents) ? root.documents : [];
  for (const row of list) collectFromDocumentRow(row, names);
}

function collectInvoiceDocuments(invoices: unknown, names: string[]): void {
  if (!Array.isArray(invoices)) return;
  for (const invoice of invoices) {
    const record = asRecord(invoice);
    if (!record) continue;
    pushUnique(names, readName(record.document));
    const details = asRecord(record.details);
    if (!details) continue;
    pushUnique(names, readName(details.document));
    if (typeof details.document_name === "string") {
      pushUnique(names, readName(details.document_name));
    }
  }
}

function collectBusinessSupportingDocuments(businessDetails: unknown, names: string[]): void {
  const root = asRecord(businessDetails);
  const why = asRecord(root?.why_raising_funds);
  collectFromFileList(why?.supporting_documents, names);
}

/** Display names only — never storage keys or binary content. */
export function extractDocumentDisplayNames(input: {
  supporting_documents?: unknown;
  acceptance_documents?: unknown;
  invoices?: unknown;
  business_details?: unknown;
}): string[] {
  const names: string[] = [];
  collectSupportingDocuments(input.supporting_documents, names);
  collectAcceptanceDocuments(input.acceptance_documents, names);
  collectInvoiceDocuments(input.invoices, names);
  collectBusinessSupportingDocuments(input.business_details, names);
  return names;
}
