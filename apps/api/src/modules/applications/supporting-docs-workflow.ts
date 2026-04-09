import { getStepKeyFromStepId } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { getFileExtension } from "../../lib/s3/client";

export function fileNameToSupportingDocTypeToken(fileName: string): "pdf" | "excel" | null {
  const ext = getFileExtension(fileName);
  if (ext === "pdf") return "pdf";
  if (ext === "xlsx" || ext === "xls") return "excel";
  return null;
}

export function contentTypeForSupportingDocFileName(fileName: string): string {
  const ext = getFileExtension(fileName);
  if (ext === "pdf") return "application/pdf";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  return "application/octet-stream";
}

/**
 * Read allowed_types from a supporting-document workflow row. Unknown tokens are ignored;
 * empty after filter defaults to pdf-only (backward compatible).
 */
export function resolveAllowedTypesFromWorkflowRow(row: unknown): string[] {
  if (!row || typeof row !== "object") return ["pdf"];
  const at = (row as Record<string, unknown>).allowed_types;
  if (!Array.isArray(at) || at.length === 0) return ["pdf"];
  const filtered = at
    .filter((x): x is string => typeof x === "string")
    .filter((t) => t === "pdf" || t === "excel");
  if (filtered.length === 0) return ["pdf"];
  const out: string[] = [];
  if (filtered.includes("pdf")) out.push("pdf");
  if (filtered.includes("excel")) out.push("excel");
  return out;
}

export function getSupportingDocAllowedTypesFromProductWorkflow(
  workflow: unknown,
  categoryKey: string,
  documentIndex: number
): string[] {
  if (!Array.isArray(workflow)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid product workflow");
  }
  for (const step of workflow) {
    const sid = (step as { id?: string })?.id ?? "";
    if (getStepKeyFromStepId(sid) !== "supporting_documents") continue;
    const config = (step as { config?: Record<string, unknown> }).config;
    if (!config || typeof config !== "object") break;
    const list = config[categoryKey];
    if (!Array.isArray(list)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid document category");
    }
    if (!Number.isInteger(documentIndex) || documentIndex < 0 || documentIndex >= list.length) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid document slot");
    }
    return resolveAllowedTypesFromWorkflowRow(list[documentIndex]);
  }
  throw new AppError(400, "VALIDATION_ERROR", "Supporting documents are not configured for this product");
}

function supportingDocumentRowHasUploadedFile(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const o = doc as Record<string, unknown>;
  const file = o.file as Record<string, unknown> | undefined;
  if (typeof file?.s3_key === "string" && file.s3_key.length > 0) return true;
  const files = o.files;
  if (Array.isArray(files)) {
    return files.some(
      (f) =>
        f &&
        typeof f === "object" &&
        typeof (f as Record<string, unknown>).s3_key === "string" &&
        String((f as Record<string, unknown>).s3_key).length > 0
    );
  }
  return false;
}

function unwrapSupportingDocumentCategoriesFromApplication(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  let raw = data as Record<string, unknown>;
  if (raw.supporting_documents && typeof raw.supporting_documents === "object") {
    raw = raw.supporting_documents as Record<string, unknown>;
  }
  const categories = raw.categories;
  return Array.isArray(categories) ? categories : [];
}

/**
 * On submit/resubmit: each workflow row with required !== false must have at least one uploaded file (s3_key).
 * Category order matches issuer: Object.entries(config), skipping enabled_categories and non-arrays.
 */
export function assertRequiredSupportingDocumentsPresent(
  workflow: unknown,
  applicationSupportingDocuments: unknown
): void {
  if (!Array.isArray(workflow) || workflow.length === 0) return;

  let config: Record<string, unknown> | null = null;
  for (const step of workflow) {
    const sid = (step as { id?: string })?.id ?? "";
    if (getStepKeyFromStepId(sid) !== "supporting_documents") continue;
    const c = (step as { config?: Record<string, unknown> }).config;
    if (c && typeof c === "object") config = c;
    break;
  }
  if (!config) return;

  const groups = Object.entries(config).filter(
    ([key, value]) => key !== "enabled_categories" && Array.isArray(value)
  );
  const appCategories = unwrapSupportingDocumentCategoriesFromApplication(applicationSupportingDocuments);

  for (let catIndex = 0; catIndex < groups.length; catIndex++) {
    const [, docs] = groups[catIndex];
    const rows = docs as unknown[];
    const appCat = appCategories[catIndex] as Record<string, unknown> | undefined;
    const appDocs = appCat?.documents;
    for (let docIndex = 0; docIndex < rows.length; docIndex++) {
      const row = rows[docIndex];
      const required = !row || typeof row !== "object" || (row as Record<string, unknown>).required !== false;
      if (!required) continue;
      const nameRaw =
        row && typeof row === "object" && typeof (row as Record<string, unknown>).name === "string"
          ? String((row as Record<string, unknown>).name).trim()
          : "";
      const name = nameRaw || "Document";
      const appDoc = Array.isArray(appDocs) ? appDocs[docIndex] : undefined;
      if (!supportingDocumentRowHasUploadedFile(appDoc)) {
        throw new AppError(400, "VALIDATION_ERROR", `This document is required: ${name}`);
      }
    }
  }
}
