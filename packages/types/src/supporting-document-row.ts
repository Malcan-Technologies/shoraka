import { parseWorkflowDocumentRow, serializeWorkflowDocumentRow, type WorkflowDocumentRow } from "./workflow-document-row";

export function parseSupportingDocumentRow(raw: unknown): WorkflowDocumentRow {
  return parseWorkflowDocumentRow(raw);
}

export function serializeSupportingDocumentRow(row: WorkflowDocumentRow): Record<string, unknown> {
  return serializeWorkflowDocumentRow(row);
}
