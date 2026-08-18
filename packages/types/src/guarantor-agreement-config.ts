import {
  parseWorkflowDocumentRow,
  serializeWorkflowDocumentRow,
  type WorkflowDocumentRow,
} from "./workflow-document-row";

const DEFAULT_GUARANTOR_AGREEMENT_NAME = "Guarantor agreement";

export function parseGuarantorAgreementRow(
  raw: unknown,
  defaults?: Partial<WorkflowDocumentRow>
): WorkflowDocumentRow {
  const parsed = parseWorkflowDocumentRow(raw);
  const { name: parsedName, ...restParsed } = parsed;
  const { name: defaultName, ...restDefaults } = defaults ?? {};
  const name =
    parsedName.trim() || defaultName?.trim() || DEFAULT_GUARANTOR_AGREEMENT_NAME;
  return {
    allow_multiple: false,
    allowed_types: ["pdf"],
    required: false,
    ...restDefaults,
    ...restParsed,
    name,
  };
}

export function serializeGuarantorAgreementRow(row: WorkflowDocumentRow): Record<string, unknown> {
  return serializeWorkflowDocumentRow({
    ...row,
    name: row.name.trim() || DEFAULT_GUARANTOR_AGREEMENT_NAME,
  });
}
