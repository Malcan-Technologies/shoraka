/**
 * Shared product workflow document row (acceptance, supporting, guarantor agreement).
 */

import {
  parseGeneratedDocumentTypeKey,
  type GeneratedDocumentTypeKey,
} from "./generated-documents";

export type WorkflowDocumentTemplate = {
  s3_key: string;
  file_name: string;
  file_size?: number;
};

export type WorkflowDocumentRow = {
  name: string;
  allow_multiple?: boolean;
  /** Omitted or true → required */
  required?: boolean;
  /** One of ["pdf"] | ["excel"]; omitted → pdf at runtime */
  allowed_types?: string[];
  template?: WorkflowDocumentTemplate;
  generated_document_type?: GeneratedDocumentTypeKey;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function resolveWorkflowDocumentRowRequired(row: { required?: boolean }): boolean {
  return row.required !== false;
}

export function resolveWorkflowDocumentAllowedTypes(row: { allowed_types?: unknown }): string[] {
  const raw = row.allowed_types;
  if (!Array.isArray(raw) || raw.length === 0) return ["pdf"];
  const filtered = raw
    .filter((x): x is string => typeof x === "string")
    .filter((t) => t === "pdf" || t === "excel");
  if (filtered.length === 0) return ["pdf"];
  return filtered[0] === "excel" ? ["excel"] : ["pdf"];
}

export function parseWorkflowDocumentRow(raw: unknown): WorkflowDocumentRow {
  const row = asRecord(raw) ?? {};
  const template = asRecord(row.template);
  const fileName =
    (typeof template?.file_name === "string" && template.file_name) ||
    (typeof template?.filename === "string" && template.filename) ||
    "";
  const name = typeof row.name === "string" ? row.name : "";
  const allowed = resolveWorkflowDocumentAllowedTypes(row);
  const generated_document_type = parseGeneratedDocumentTypeKey(row.generated_document_type);

  const base: WorkflowDocumentRow = {
    name,
    required: typeof row.required === "boolean" ? row.required : undefined,
    allow_multiple: row.allow_multiple === true,
    allowed_types: allowed,
  };

  if (generated_document_type) {
    return { ...base, generated_document_type };
  }

  if (template?.s3_key != null && typeof template.s3_key === "string" && template.s3_key.length > 0) {
    return {
      ...base,
      template: {
        s3_key: template.s3_key,
        file_name: fileName,
        ...(typeof template.file_size === "number" ? { file_size: template.file_size } : {}),
      },
    };
  }

  return base;
}

/** Persist row JSON; generated type and upload template are mutually exclusive. */
export function serializeWorkflowDocumentRow(row: WorkflowDocumentRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: row.name,
    allow_multiple: row.allow_multiple === true,
    ...(typeof row.required === "boolean" ? { required: row.required } : {}),
    allowed_types: resolveWorkflowDocumentAllowedTypes(row),
  };

  if (row.generated_document_type) {
    payload.generated_document_type = row.generated_document_type;
    return payload;
  }

  const s3Key = row.template?.s3_key?.trim();
  if (s3Key) {
    payload.template = {
      s3_key: s3Key,
      file_name: row.template?.file_name?.trim() || "template.pdf",
      ...(typeof row.template?.file_size === "number" ? { file_size: row.template.file_size } : {}),
    };
  }

  return payload;
}
