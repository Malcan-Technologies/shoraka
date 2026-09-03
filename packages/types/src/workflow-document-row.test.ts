import {
  isPrimarySignedOfferDocument,
  isSigningPackagePreviewDocument,
  listGeneratedDocumentTypesForContext,
  parseGeneratedDocumentTypeKey,
  pickPrimarySignedOfferDocument,
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

const LO_KEY: GeneratedDocumentTypeKey = "arf_contract_facility_lo";
const JSG_KEY: GeneratedDocumentTypeKey = "arf_joint_several_guarantee";
const DOA_KEY: GeneratedDocumentTypeKey = "arf_deed_of_assignment";
const FA_KEY: GeneratedDocumentTypeKey = "arf_facility_agreement";

describe("generated document catalog", () => {
  it("lists one type for acceptance_documents", () => {
    const types = listGeneratedDocumentTypesForContext("acceptance_documents");
    expect(types).toHaveLength(1);
    expect(types[0]?.key).toBe(LO_KEY);
    expect(types[0]?.label).toContain("Letter of Offer");
  });

  it("lists no types for supporting_documents until configured", () => {
    expect(listGeneratedDocumentTypesForContext("supporting_documents")).toHaveLength(0);
  });

  it("lists no types for guarantor_agreement (business-details uploads stay separate)", () => {
    expect(listGeneratedDocumentTypesForContext("guarantor_agreement")).toHaveLength(0);
  });

  it("lists JSG, Deed of Assignment, and Facility Agreement for signing_packages", () => {
    const types = listGeneratedDocumentTypesForContext("signing_packages");
    expect(types.map((type) => type.key)).toEqual([JSG_KEY, DOA_KEY, FA_KEY]);
    expect(types[0]?.label).toContain("Joint and Several Guarantee");
    expect(types[1]?.label).toContain("Deed of Assignment");
    expect(types[2]?.label).toContain("Facility Agreement");
  });

  it("parses catalog keys and rejects unknown keys", () => {
    expect(parseGeneratedDocumentTypeKey("arf_contract_facility_lo")).toBe(LO_KEY);
    expect(parseGeneratedDocumentTypeKey("arf_joint_several_guarantee")).toBe(JSG_KEY);
    expect(parseGeneratedDocumentTypeKey("arf_deed_of_assignment")).toBe(DOA_KEY);
    expect(parseGeneratedDocumentTypeKey("arf_facility_agreement")).toBe(FA_KEY);
    expect(parseGeneratedDocumentTypeKey("arf_contract_facility_loo")).toBeUndefined();
  });

  it("marks generated signing-package documents as previewable", () => {
    expect(
      isSigningPackagePreviewDocument({ key: "deed_of_assignment", source: "TEMPLATE" })
    ).toBe(true);
    expect(
      isSigningPackagePreviewDocument({ key: "guarantor_agreement", source: "TEMPLATE" })
    ).toBe(true);
    expect(
      isSigningPackagePreviewDocument({ key: "facility_agreement", source: "TEMPLATE" })
    ).toBe(true);
    expect(
      isSigningPackagePreviewDocument({ key: "offer_letter", source: "GENERATED_OFFER_LETTER" })
    ).toBe(true);
    expect(
      isSigningPackagePreviewDocument({ key: "board_resolution", source: "ISSUER_UPLOAD" })
    ).toBe(false);
  });

  it("prefers a signed Facility Agreement over a legacy Offer Letter", () => {
    expect(
      isPrimarySignedOfferDocument({
        source: "TEMPLATE",
        template_ref: "facility_agreement",
        has_signed_pdf: true,
      })
    ).toBe(true);
    expect(
      isPrimarySignedOfferDocument({
        source: "GENERATED_OFFER_LETTER",
        has_signed_pdf: true,
      })
    ).toBe(true);

    const picked = pickPrimarySignedOfferDocument([
      {
        source: "GENERATED_OFFER_LETTER",
        signed_s3_key: "s3/legacy.pdf",
      },
      {
        source: "TEMPLATE",
        template_ref: "facility_agreement",
        signed_s3_key: "s3/fa.pdf",
      },
      {
        source: "TEMPLATE",
        template_ref: "guarantor_agreement",
        signed_s3_key: "s3/jsg.pdf",
      },
    ]);
    expect(picked?.signed_s3_key).toBe("s3/fa.pdf");
  });
});

describe("workflow document row parse/serialize", () => {
  it("round-trips generated_document_type", () => {
    const row: WorkflowDocumentRow = {
      name: "Letter of Offer",
      allow_multiple: false,
      required: true,
      allowed_types: ["pdf"],
      generated_document_type: LO_KEY,
    };
    const serialized = serializeWorkflowDocumentRow(row);
    expect(serialized.generated_document_type).toBe(LO_KEY);
    expect(serialized.template).toBeUndefined();

    const parsed = parseWorkflowDocumentRow(serialized);
    expect(parsed.generated_document_type).toBe(LO_KEY);
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
      generated_document_type: LO_KEY,
      template: { s3_key: "templates/old.pdf", file_name: "old.pdf" },
    });
    expect(parsed.generated_document_type).toBe(LO_KEY);
    expect(parsed.template).toBeUndefined();
  });

  it("serialize strips template when generated type is set", () => {
    const serialized = serializeWorkflowDocumentRow({
      name: "Letter of Offer",
      generated_document_type: LO_KEY,
      template: { s3_key: "templates/old.pdf", file_name: "old.pdf" },
    });
    expect(serialized.generated_document_type).toBe(LO_KEY);
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
        generated_document_type: LO_KEY,
      },
    ]);
    const rows = parseAcceptanceDocumentsConfig(financingConfig);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.generated_document_type).toBe(LO_KEY);
    expect(rows[0]?.template).toBeUndefined();
  });
});

describe("supporting document row round-trip", () => {
  it("preserves generated_document_type", () => {
    const serialized = serializeSupportingDocumentRow({
      name: "Supporting doc",
      generated_document_type: LO_KEY,
    });
    const parsed = parseSupportingDocumentRow(serialized);
    expect(parsed.generated_document_type).toBe(LO_KEY);
  });
});

describe("guarantor agreement row round-trip", () => {
  it("preserves generated_document_type", () => {
    const serialized = serializeGuarantorAgreementRow({
      name: "Guarantor agreement",
      generated_document_type: JSG_KEY,
    });
    const parsed = parseGuarantorAgreementRow(serialized);
    expect(parsed.generated_document_type).toBe(JSG_KEY);
  });
});
