import { AppError } from "../../../lib/http/error-handler";
import { NoteDocumentsService } from "./service";
import type { NoteDocumentCatalogSnapshot } from "./catalog";

const mockGenerateDocument = jest.fn();
const mockGetS3ObjectBuffer = jest.fn();

jest.mock("../../generated-documents/service", () => ({
  generatedDocumentsService: {
    generateDocument: (...args: unknown[]) => mockGenerateDocument(...args),
  },
  workflowDeclaresGeneratedDocumentType: () => true,
}));

jest.mock("../../../lib/s3/client", () => ({
  getS3ObjectBuffer: (...args: unknown[]) => mockGetS3ObjectBuffer(...args),
}));

jest.mock("./facility-agreement-package", () => {
  const actual = jest.requireActual("./facility-agreement-package");
  return {
    ...actual,
    composeFacilityAgreementPackage: jest.fn(async () => ({
      bytes: Buffer.from("%PDF-compiled"),
      schedule3Page: 2,
      eCertificatePage: 4,
      pageCount: 6,
    })),
  };
});

function signedDoc(template: string) {
  return {
    id: `doc-${template}`,
    name: template,
    template_ref: template,
    signed_s3_key: `applications/app-1/${template}.pdf`,
    signed_file_sha256: `hash-${template}`,
    status: "COMPLETED",
  };
}

describe("NoteDocumentsService content guards", () => {
  const snapshotBase = {
    noteId: "note-1",
    noteReference: "NOTE-001",
    envelope: {
      id: "env-1",
      status: "COMPLETED",
      application_id: "app-1",
      contract_id: "c1",
      invoice_id: null,
      completed_at: new Date(),
      documents: [signedDoc("facility_agreement")],
    },
    jsg: null,
    facilityAgreement: signedDoc("facility_agreement"),
    doa: null,
    letterOfOffer: { hasContract: true, offerSent: true, declaredOnProduct: true },
    prospectus: { approved: false, pdfReady: false },
    investmentCertificate: {
      issuedReady: false,
      pending: false,
      failed: false,
      filename: null,
    },
    shoraka: [],
    faPackageGeneratedAt: null,
  } satisfies NoteDocumentCatalogSnapshot;

  it("does not update the signed FA record when compiling a package", async () => {
    const create = jest.fn().mockResolvedValue({});
    const update = jest.fn();
    const service = new NoteDocumentsService({
      note: {
        findUnique: jest.fn().mockResolvedValue({
          id: "note-1",
          note_reference: "NOTE-001",
          source_application_id: "app-1",
          source_contract_id: "c1",
          source_invoice_id: null,
        }),
      },
      signingDocument: { update },
      facilityAgreementPackageEvidence: { create },
    } as never);

    mockGetS3ObjectBuffer.mockResolvedValue(Buffer.from("%PDF-fa"));
    mockGenerateDocument.mockResolvedValue({
      buffer: Buffer.from("%PDF-lo"),
      filename: "LO.pdf",
      contentType: "application/pdf",
      templateSha256: "tmpl",
      outputSha256: "out",
    });

    const content = await (
      service as unknown as {
        composePackage: (
          snapshot: NoteDocumentCatalogSnapshot,
          actor: { userId: string }
        ) => Promise<{ filename: string }>;
      }
    ).composePackage(snapshotBase, { userId: "A0001" });

    expect(content.filename).toBe("Facility-Agreement-Package-NOTE-001.pdf");
    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assembler_version: 1,
          signed_fa_sha256: "hash-facility_agreement",
          lo_template_sha256: "tmpl",
          lo_output_sha256: "out",
          created_by_user_id: "A0001",
        }),
      })
    );
  });

  it("rejects unavailable catalog rows instead of streaming storage keys", async () => {
    const service = new NoteDocumentsService({
      note: {
        findUnique: jest.fn().mockResolvedValue({
          id: "note-1",
          note_reference: "NOTE-001",
          source_application_id: "app-1",
          source_contract_id: "c1",
          source_invoice_id: null,
          prospectus_review: null,
        }),
      },
      signingEnvelope: { findMany: jest.fn().mockResolvedValue([]) },
      application: { findUnique: jest.fn().mockResolvedValue(null) },
      noteProspectusPublication: { findUnique: jest.fn() },
      noteInvestmentCertificate: { findMany: jest.fn().mockResolvedValue([]) },
      shorakaTradeOrder: { findMany: jest.fn().mockResolvedValue([]) },
      facilityAgreementPackageEvidence: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never);

    await expect(service.getContent("note-1", "jsg", { userId: "A0001" })).rejects.toEqual(
      expect.objectContaining({
        code: "NOTE_DOCUMENT_UNAVAILABLE",
      } satisfies Partial<AppError>)
    );
  });
});
