/**
 * Offer-acceptance documents (e.g. Board Resolution).
 * Configured on the financing_type step as `acceptance_documents` (flat list).
 * Legacy: supporting_documents rows with upload_timing === "post_application".
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

/** Resolved row for gates / UI, including legacy supporting-docs location when applicable. */
export type ResolvedAcceptanceDocument = AcceptanceDocumentRow & {
  /** Index in the flat acceptance list (new config) or synthetic flat index (legacy). */
  index: number;
  /** When sourced from legacy supporting_documents upload_timing rows. */
  legacy?: { categoryKey: string; documentIndex: number };
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

function findSupportingDocumentsConfig(workflow: unknown): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  for (const step of workflow) {
    const sid = String((step as { id?: unknown })?.id ?? "");
    if (getStepKeyFromStepId(sid) !== "supporting_documents") continue;
    return asRecord((step as { config?: unknown }).config);
  }
  return null;
}

/**
 * Prefer financing_type.acceptance_documents when the key is present (including empty array).
 * Otherwise dual-read legacy supporting_documents rows with upload_timing post_application.
 */
export function resolveAcceptanceDocumentsFromWorkflow(
  workflow: unknown
): ResolvedAcceptanceDocument[] {
  const financingConfig = findFinancingTypeConfig(workflow);
  if (financingConfig && ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY in financingConfig) {
    const list = financingConfig[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY];
    if (!Array.isArray(list)) return [];
    return list.map((row, index) => parseAcceptanceDocumentRow(row, index));
  }

  const supportConfig = findSupportingDocumentsConfig(workflow);
  if (!supportConfig) return [];

  const resolved: ResolvedAcceptanceDocument[] = [];
  for (const [categoryKey, value] of Object.entries(supportConfig)) {
    if (categoryKey === "enabled_categories" || !Array.isArray(value)) continue;
    value.forEach((row, documentIndex) => {
      const record = asRecord(row);
      if (!record || record.upload_timing !== "post_application") return;
      const parsed = parseAcceptanceDocumentRow(row, resolved.length);
      resolved.push({
        ...parsed,
        legacy: { categoryKey, documentIndex },
      });
    });
  }
  return resolved;
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

function unwrapSupportingDocumentCategories(data: unknown): unknown[] {
  const root = asRecord(data);
  if (!root) return [];
  let raw = root;
  if (root.supporting_documents && typeof root.supporting_documents === "object") {
    raw = root.supporting_documents as Record<string, unknown>;
  }
  return Array.isArray(raw.categories) ? raw.categories : [];
}

function findSupportingDocAtLegacySlot(
  supportingDocuments: unknown,
  categoryKey: string,
  documentIndex: number,
  categoryOrder: string[]
): unknown {
  const categories = unwrapSupportingDocumentCategories(supportingDocuments);
  const catIndex = categoryOrder.indexOf(categoryKey);
  if (catIndex < 0) return undefined;
  const appCat = asRecord(categories[catIndex]);
  const appDocs = Array.isArray(appCat?.documents) ? appCat.documents : [];
  const indexed = appDocs.find((doc) => {
    const r = asRecord(doc);
    return r?.workflow_document_index === documentIndex;
  });
  return indexed ?? appDocs[documentIndex];
}

function legacyCategoryOrderFromWorkflow(workflow: unknown): string[] {
  const config = findSupportingDocumentsConfig(workflow);
  if (!config) return [];
  return Object.entries(config)
    .filter(([key, value]) => key !== "enabled_categories" && Array.isArray(value))
    .map(([key]) => key);
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

/** True when every required acceptance doc has at least one uploaded file (new or legacy storage). */
export function acceptanceDocumentsReady(
  workflow: unknown,
  acceptanceDocuments: unknown,
  supportingDocuments?: unknown
): boolean {
  const rows = resolveAcceptanceDocumentsFromWorkflow(workflow);
  const categoryOrder = legacyCategoryOrderFromWorkflow(workflow);
  for (const row of rows) {
    if (!resolveAcceptanceDocumentRowRequired(row)) continue;
    const fromNew = findAcceptanceUpload(acceptanceDocuments, row.index);
    if (documentHasUploadedFile(fromNew)) continue;
    if (row.legacy && supportingDocuments != null) {
      const fromLegacy = findSupportingDocAtLegacySlot(
        supportingDocuments,
        row.legacy.categoryKey,
        row.legacy.documentIndex,
        categoryOrder
      );
      if (documentHasUploadedFile(fromLegacy)) continue;
    }
    return false;
  }
  return true;
}

function slugForDocName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
}

/**
 * Review item scope keys for acceptance docs that have uploads.
 * New storage → acceptance_documents:<index>:<slug>
 * Legacy-only uploads → supporting_documents:<category>:<index>:<slug>
 */
export function collectAcceptanceDocumentReviewKeys(
  workflow: unknown,
  acceptanceDocuments: unknown,
  supportingDocuments?: unknown
): string[] {
  const rows = resolveAcceptanceDocumentsFromWorkflow(workflow);
  const categoryOrder = legacyCategoryOrderFromWorkflow(workflow);
  const keys: string[] = [];

  for (const row of rows) {
    const name = row.name.trim() || "Document";
    const slug = slugForDocName(name);
    const fromNew = findAcceptanceUpload(acceptanceDocuments, row.index);
    if (documentHasUploadedFile(fromNew)) {
      keys.push(`acceptance_documents:${row.index}:${slug}`);
      continue;
    }
    if (row.legacy && supportingDocuments != null) {
      const fromLegacy = findSupportingDocAtLegacySlot(
        supportingDocuments,
        row.legacy.categoryKey,
        row.legacy.documentIndex,
        categoryOrder
      );
      if (documentHasUploadedFile(fromLegacy)) {
        keys.push(
          `supporting_documents:${row.legacy.categoryKey}:${row.legacy.documentIndex}:${slug}`
        );
      }
    }
  }
  return keys;
}

/**
 * Extract post_application rows from supporting_documents config into a flat list,
 * strip upload_timing from remaining supporting rows, and write acceptance_documents
 * onto financing_type when not already present.
 */
export function migrateWorkflowAcceptanceDocuments<T extends { id?: string; config?: unknown }>(
  workflow: T[]
): T[] {
  if (!Array.isArray(workflow) || workflow.length === 0) return workflow;

  let extracted: AcceptanceDocumentRow[] | null = null;

  const next = workflow.map((step) => {
    const sid = String(step.id ?? "");
    const stepKey = getStepKeyFromStepId(sid);
    const config = asRecord(step.config);
    if (!config) return step;

    if (stepKey === "supporting_documents") {
      const nextConfig: Record<string, unknown> = { ...config };
      const pulled: AcceptanceDocumentRow[] = [];
      for (const [key, value] of Object.entries(config)) {
        if (key === "enabled_categories" || !Array.isArray(value)) continue;
        const kept: unknown[] = [];
        for (const row of value) {
          const record = asRecord(row);
          if (record?.upload_timing === "post_application") {
            const { upload_timing: _timing, ...rest } = record;
            void _timing;
            const parsed = parseAcceptanceDocumentRow(rest, pulled.length);
            const { index: _i, legacy: _l, ...doc } = parsed;
            void _i;
            void _l;
            pulled.push(doc);
          } else if (record) {
            const { upload_timing: _timing, ...rest } = record;
            void _timing;
            kept.push(rest);
          } else {
            kept.push(row);
          }
        }
        if (kept.length > 0) nextConfig[key] = kept;
        else delete nextConfig[key];
      }
      if (pulled.length > 0) extracted = pulled;
      return { ...step, config: nextConfig };
    }

    return step;
  });

  return next.map((step) => {
    const sid = String(step.id ?? "");
    if (getStepKeyFromStepId(sid) !== "financing_type") return step;
    const config = { ...(asRecord(step.config) ?? {}) };
    const existing = config[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY];
    const existingList = Array.isArray(existing) ? existing : null;
    if (extracted && extracted.length > 0) {
      if (!existingList || existingList.length === 0) {
        config[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY] = extracted;
      }
    } else if (!(ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY in config)) {
      config[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY] = [];
    }
    return { ...step, config };
  });
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
    const { index: _i, legacy: _l, ...rest } = parsed;
    void _i;
    void _l;
    return rest;
  });
}
