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
