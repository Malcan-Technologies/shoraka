/**
 * Offer-acceptance documents (e.g. Board Resolution).
 * Configured on the financing_type step as `acceptance_documents` (flat list).
 */

import { getStepKeyFromStepId } from "./application-steps";

export const ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY = "acceptance_documents";

export type AcceptanceDocumentRow = {
  name: string;
  /** Omitted or true → required */
  required?: boolean;
  allow_multiple?: boolean;
  /** One of ["pdf"] | ["excel"]; omitted → pdf at runtime */
  allowed_types?: string[];
  template?: { s3_key: string; file_name: string; file_size?: number };
};

export type AcceptanceDocumentFile = {
  file_name: string;
  file_size: number;
  s3_key: string;
  uploaded_at?: string;
};

export type AcceptanceDocumentUpload = {
  title: string;
  workflow_document_index: number;
  file?: AcceptanceDocumentFile;
  files?: AcceptanceDocumentFile[];
};

export type AcceptanceDocumentsPayload = {
  documents: AcceptanceDocumentUpload[];
};

/** Resolved row for gates / UI. */
export type ResolvedAcceptanceDocument = AcceptanceDocumentRow & {
  /** Index in the flat acceptance list. */
  index: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function resolveAcceptanceDocumentRowRequired(row: { required?: boolean }): boolean {
  return row.required !== false;
}

export function resolveAcceptanceDocumentAllowedTypes(row: {
  allowed_types?: unknown;
}): string[] {
  const raw = row.allowed_types;
  if (!Array.isArray(raw) || raw.length === 0) return ["pdf"];
  const filtered = raw
    .filter((x): x is string => typeof x === "string")
    .filter((t) => t === "pdf" || t === "excel");
  if (filtered.length === 0) return ["pdf"];
  return filtered[0] === "excel" ? ["excel"] : ["pdf"];
}

function parseAcceptanceDocumentRow(raw: unknown, index: number): ResolvedAcceptanceDocument {
  const row = asRecord(raw) ?? {};
  const template = asRecord(row.template);
  const fileName =
    (typeof template?.file_name === "string" && template.file_name) ||
    (typeof template?.filename === "string" && template.filename) ||
    "";
  const name = typeof row.name === "string" ? row.name : "";
  const allowed = resolveAcceptanceDocumentAllowedTypes(row);
  return {
    index,
    name,
    required: typeof row.required === "boolean" ? row.required : undefined,
    allow_multiple: row.allow_multiple === true,
    allowed_types: allowed,
    ...(template?.s3_key != null && typeof template.s3_key === "string"
      ? {
          template: {
            s3_key: template.s3_key,
            file_name: fileName,
            ...(typeof template.file_size === "number" ? { file_size: template.file_size } : {}),
          },
        }
      : {}),
  };
}

function findFinancingTypeConfig(workflow: unknown): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  for (const step of workflow) {
    const sid = String((step as { id?: unknown })?.id ?? "");
    if (getStepKeyFromStepId(sid) !== "financing_type") continue;
    return asRecord((step as { config?: unknown }).config);
  }
  return null;
}

/** Read financing_type.acceptance_documents from the product workflow. */
export function resolveAcceptanceDocumentsFromWorkflow(
  workflow: unknown
): ResolvedAcceptanceDocument[] {
  const financingConfig = findFinancingTypeConfig(workflow);
  const list = financingConfig?.[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY];
  if (!Array.isArray(list)) return [];
  return list.map((row, index) => parseAcceptanceDocumentRow(row, index));
}

export function workflowHasAcceptanceDocuments(workflow: unknown): boolean {
  return resolveAcceptanceDocumentsFromWorkflow(workflow).length > 0;
}

export function workflowHasRequiredAcceptanceDocuments(workflow: unknown): boolean {
  return resolveAcceptanceDocumentsFromWorkflow(workflow).some((row) =>
    resolveAcceptanceDocumentRowRequired(row)
  );
}

function documentHasUploadedFile(doc: unknown): boolean {
  const record = asRecord(doc);
  if (!record) return false;
  const file = asRecord(record.file);
  if (typeof file?.s3_key === "string" && file.s3_key.length > 0) return true;
  const files = record.files;
  if (Array.isArray(files)) {
    return files.some((f) => {
      const fr = asRecord(f);
      return typeof fr?.s3_key === "string" && fr.s3_key.length > 0;
    });
  }
  return false;
}

function unwrapAcceptanceDocuments(payload: unknown): AcceptanceDocumentUpload[] {
  const root = asRecord(payload);
  if (!root) return [];
  if (Array.isArray(root.documents)) {
    return root.documents as AcceptanceDocumentUpload[];
  }
  if (Array.isArray(payload)) {
    return payload as AcceptanceDocumentUpload[];
  }
  return [];
}

function findAcceptanceUpload(
  payload: unknown,
  workflowDocumentIndex: number
): AcceptanceDocumentUpload | undefined {
  const docs = unwrapAcceptanceDocuments(payload);
  const indexed = docs.find((d) => d?.workflow_document_index === workflowDocumentIndex);
  return indexed ?? docs[workflowDocumentIndex];
}

/** True when every required acceptance doc has at least one uploaded file. */
export function acceptanceDocumentsReady(
  workflow: unknown,
  acceptanceDocuments: unknown
): boolean {
  const rows = resolveAcceptanceDocumentsFromWorkflow(workflow);
  for (const row of rows) {
    if (!resolveAcceptanceDocumentRowRequired(row)) continue;
    const upload = findAcceptanceUpload(acceptanceDocuments, row.index);
    if (documentHasUploadedFile(upload)) continue;
    return false;
  }
  return true;
}

function slugForDocName(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "_").slice(0, 32) || "doc";
}

/** Review item scope keys for acceptance docs that have uploads: acceptance_documents:<index>:<slug> */
export function collectAcceptanceDocumentReviewKeys(
  workflow: unknown,
  acceptanceDocuments: unknown
): string[] {
  const rows = resolveAcceptanceDocumentsFromWorkflow(workflow);
  const keys: string[] = [];

  for (const row of rows) {
    const name = row.name.trim() || "Document";
    const slug = slugForDocName(name);
    const upload = findAcceptanceUpload(acceptanceDocuments, row.index);
    if (documentHasUploadedFile(upload)) {
      keys.push(`acceptance_documents:${row.index}:${slug}`);
    }
  }
  return keys;
}

export function writeAcceptanceDocumentsConfig(
  financingTypeConfig: Record<string, unknown>,
  documents: AcceptanceDocumentRow[]
): Record<string, unknown> {
  return {
    ...financingTypeConfig,
    [ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY]: documents,
  };
}

export function parseAcceptanceDocumentsConfig(
  financingTypeConfig: unknown
): AcceptanceDocumentRow[] {
  const config = asRecord(financingTypeConfig);
  const list = config?.[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY];
  if (!Array.isArray(list)) return [];
  return list.map((row, index) => {
    const parsed = parseAcceptanceDocumentRow(row, index);
    const { index: _i, ...rest } = parsed;
    void _i;
    return rest;
  });
}
