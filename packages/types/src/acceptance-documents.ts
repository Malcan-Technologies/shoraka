/**
 * Offer-acceptance documents (e.g. Board Resolution).
 * Configured on the financing_type step as `acceptance_documents` (flat list).
 */

import { getStepKeyFromStepId } from "./application-steps";
import type { GeneratedDocumentTypeKey } from "./generated-documents";
import {
  parseWorkflowDocumentRow,
  resolveWorkflowDocumentAllowedTypes,
  resolveWorkflowDocumentRowRequired,
  serializeWorkflowDocumentRow,
  type WorkflowDocumentRow,
} from "./workflow-document-row";

export const ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY = "acceptance_documents";

export type AcceptanceDocumentRow = WorkflowDocumentRow;

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
  return resolveWorkflowDocumentRowRequired(row);
}

export function resolveAcceptanceDocumentAllowedTypes(row: { allowed_types?: unknown }): string[] {
  return resolveWorkflowDocumentAllowedTypes(row);
}

function parseAcceptanceDocumentRow(raw: unknown, index: number): ResolvedAcceptanceDocument {
  return { index, ...parseWorkflowDocumentRow(raw) };
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

export function workflowAcceptanceDocumentsIncludeGeneratedType(
  workflow: unknown,
  typeKey: GeneratedDocumentTypeKey
): boolean {
  return resolveAcceptanceDocumentsFromWorkflow(workflow).some(
    (row) => row.generated_document_type === typeKey
  );
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

export function slugForAcceptanceDocName(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "_").slice(0, 32) || "doc";
}

/** @deprecated use slugForAcceptanceDocName */
function slugForDocName(name: string): string {
  return slugForAcceptanceDocName(name);
}

/** Item review keys: `acceptance_documents:<index>:<slug>`. */
export function isAcceptanceDocumentItemId(itemId: string): boolean {
  return itemId.startsWith("acceptance_documents:");
}

export function parseAcceptanceDocumentItemIndex(itemId: string): number | null {
  if (!isAcceptanceDocumentItemId(itemId)) return null;
  const idx = Number.parseInt(itemId.split(":")[1] ?? "", 10);
  return Number.isFinite(idx) ? idx : null;
}

/** Match admin item scope_key to an issuer acceptance row (slug suffix may differ). */
export function acceptanceDocScopeKeyMatchesRow(
  scopeKey: string,
  documentIndex: number,
  slug: string
): boolean {
  const sk = scopeKey.trim().toLowerCase();
  const exact = `acceptance_documents:${documentIndex}:${slug}`.toLowerCase();
  if (sk === exact) return true;
  return sk.startsWith(`acceptance_documents:${documentIndex}:`);
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

/**
 * Invoice draws store acceptance uploads on the facility application.
 * Prefer the source app when it has uploads; otherwise use the originating facility.
 */
export function resolveNotePublishAcceptanceReview(input: {
  workflow: unknown;
  sourceApplicationId: string;
  sourceAcceptanceDocuments: unknown;
  originatingApplicationId?: string | null;
  originatingAcceptanceDocuments?: unknown;
}): { applicationId: string; docKeys: string[] } {
  const sourceKeys = collectAcceptanceDocumentReviewKeys(
    input.workflow,
    input.sourceAcceptanceDocuments
  );
  if (sourceKeys.length > 0) {
    return { applicationId: input.sourceApplicationId, docKeys: sourceKeys };
  }
  const originatingId = input.originatingApplicationId?.trim() || null;
  if (originatingId && originatingId !== input.sourceApplicationId) {
    const originatingKeys = collectAcceptanceDocumentReviewKeys(
      input.workflow,
      input.originatingAcceptanceDocuments
    );
    if (originatingKeys.length > 0) {
      return { applicationId: originatingId, docKeys: originatingKeys };
    }
  }
  return { applicationId: input.sourceApplicationId, docKeys: [] };
}

export function writeAcceptanceDocumentsConfig(
  financingTypeConfig: Record<string, unknown>,
  documents: AcceptanceDocumentRow[]
): Record<string, unknown> {
  return {
    ...financingTypeConfig,
    [ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY]: documents.map((doc) => serializeWorkflowDocumentRow(doc)),
  };
}

export function parseAcceptanceDocumentsConfig(
  financingTypeConfig: unknown
): AcceptanceDocumentRow[] {
  const config = asRecord(financingTypeConfig);
  const list = config?.[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY];
  if (!Array.isArray(list)) return [];
  return list.map((row) => parseWorkflowDocumentRow(row));
}
