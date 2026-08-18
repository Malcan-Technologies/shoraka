import {
  listGeneratedDocumentTypesForContext,
  type GeneratedDocumentTypeKey,
} from "./generated-documents";
import {
  parseWorkflowDocumentRow,
  serializeWorkflowDocumentRow,
  type WorkflowDocumentRow,
} from "./workflow-document-row";
import {
  parseAcceptanceDocumentsConfig,
  writeAcceptanceDocumentsConfig,
} from "./acceptance-documents";
import {
  parseGuarantorAgreementRow,
  serializeGuarantorAgreementRow,
} from "./guarantor-agreement-config";
import {
  parseSupportingDocumentRow,
  serializeSupportingDocumentRow,
} from "./supporting-document-row";

const LOO_KEY: GeneratedDocumentTypeKey = "arf_contract_facility_loo";

describe("generated document catalog", () => {
  it("lists one type for acceptance_documents", () => {
    const types = listGeneratedDocumentTypesForContext("acceptance_documents");
    expect(types).toHaveLength(1);
    expect(types[0]?.key).toBe(LOO_KEY);
  });

  it("lists no types for supporting_documents until configured", () => {
    expect(listGeneratedDocumentTypesForContext("supporting_documents")).toHaveLength(0);
  });

  it("lists no types for guarantor_agreement until configured", () => {
    expect(listGeneratedDocumentTypesForContext("guarantor_agreement")).toHaveLength(0);
  });
});

describe("workflow document row parse/serialize", () => {
  it("round-trips generated_document_type", () => {
    const row: WorkflowDocumentRow = {
      name: "Letter of Offer",
      allow_multiple: false,
      required: true,
      allowed_types: ["pdf"],
      generated_document_type: LOO_KEY,
    };
    const serialized = serializeWorkflowDocumentRow(row);
    expect(serialized.generated_document_type).toBe(LOO_KEY);
    expect(serialized.template).toBeUndefined();

    const parsed = parseWorkflowDocumentRow(serialized);
    expect(parsed.generated_document_type).toBe(LOO_KEY);
    expect(parsed.template).toBeUndefined();
  });

  it("drops unknown generated_document_type keys", () => {
    const parsed = parseWorkflowDocumentRow({
      name: "Doc",
      generated_document_type: "not_a_real_type",
    });
    expect(parsed.generated_document_type).toBeUndefined();
  });

  it("round-trips upload template without generated type", () => {
    const row: WorkflowDocumentRow = {
      name: "Board Resolution",
      template: { s3_key: "templates/board.pdf", file_name: "board.pdf", file_size: 1024 },
    };
    const parsed = parseWorkflowDocumentRow(serializeWorkflowDocumentRow(row));
    expect(parsed.template?.s3_key).toBe("templates/board.pdf");
    expect(parsed.generated_document_type).toBeUndefined();
  });

  it("prefers generated type over template when both are present in raw JSON", () => {
    const parsed = parseWorkflowDocumentRow({
      name: "Letter of Offer",
      generated_document_type: LOO_KEY,
      template: { s3_key: "templates/old.pdf", file_name: "old.pdf" },
    });
    expect(parsed.generated_document_type).toBe(LOO_KEY);
    expect(parsed.template).toBeUndefined();
  });

  it("serialize strips template when generated type is set", () => {
    const serialized = serializeWorkflowDocumentRow({
      name: "Letter of Offer",
      generated_document_type: LOO_KEY,
      template: { s3_key: "templates/old.pdf", file_name: "old.pdf" },
    });
    expect(serialized.generated_document_type).toBe(LOO_KEY);
    expect(serialized.template).toBeUndefined();
  });
});

describe("acceptance documents config round-trip", () => {
  it("preserves generated_document_type through write/parse", () => {
    const financingConfig = writeAcceptanceDocumentsConfig({}, [
      {
        name: "Letter of Offer",
        required: true,
        allow_multiple: false,
        allowed_types: ["pdf"],
        generated_document_type: LOO_KEY,
      },
    ]);
    const rows = parseAcceptanceDocumentsConfig(financingConfig);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.generated_document_type).toBe(LOO_KEY);
    expect(rows[0]?.template).toBeUndefined();
  });
});

describe("supporting document row round-trip", () => {
  it("preserves generated_document_type", () => {
    const serialized = serializeSupportingDocumentRow({
      name: "Supporting doc",
      generated_document_type: LOO_KEY,
    });
    const parsed = parseSupportingDocumentRow(serialized);
    expect(parsed.generated_document_type).toBe(LOO_KEY);
  });
});

describe("guarantor agreement row round-trip", () => {
  it("preserves generated_document_type", () => {
    const serialized = serializeGuarantorAgreementRow({
      name: "Guarantor agreement",
      generated_document_type: LOO_KEY,
    });
    const parsed = parseGuarantorAgreementRow(serialized);
    expect(parsed.generated_document_type).toBe(LOO_KEY);
  });
});
