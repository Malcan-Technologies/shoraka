import { AppError } from "../../../lib/http/error-handler";
import { FacilityDocumentsService } from "./service";
import type { FacilityDocumentCatalogSnapshot } from "./catalog";

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

jest.mock("../../notes/documents/facility-agreement-package", () => {
  const actual = jest.requireActual("../../notes/documents/facility-agreement-package");
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

function snapshotDb(overrides: Record<string, unknown> = {}) {
  return {
    contract: {
      findUnique: jest.fn().mockResolvedValue({
        id: "fac-1",
        display_reference: "FAC-001",
        originating_application_id: "app-1",
        contract_details: {},
        offer_details: {},
      }),
    },
    signingEnvelope: { findMany: jest.fn().mockResolvedValue([]) },
    application: { findUnique: jest.fn().mockResolvedValue(null) },
    product: { findUnique: jest.fn(), findFirst: jest.fn() },
    note: { findMany: jest.fn().mockResolvedValue([]) },
    facilityAgreementPackageEvidence: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    shorakaTradeOrder: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

describe("FacilityDocumentsService content guards", () => {
  it("rejects unavailable catalog rows instead of streaming storage keys", async () => {
    const service = new FacilityDocumentsService(snapshotDb() as never);

    await expect(service.getContent("fac-1", "jsg", { userId: "A0001" })).rejects.toEqual(
      expect.objectContaining({
        code: "FACILITY_DOCUMENT_UNAVAILABLE",
      } satisfies Partial<AppError>)
    );
  });

  it("streams the uploaded commercial contract without returning the key", async () => {
    const service = new FacilityDocumentsService(
      snapshotDb({
        contract: {
          findUnique: jest.fn().mockResolvedValue({
            id: "fac-1",
            display_reference: "FAC-001",
            originating_application_id: "app-1",
            contract_details: {
              document: { s3_key: "uploads/contract.pdf", file_name: "Test PDF.pdf" },
            },
            offer_details: {},
          }),
        },
      }) as never
    );
    mockGetS3ObjectBuffer.mockResolvedValue(Buffer.from("%PDF-contract"));

    const content = await service.getContent("fac-1", "underlying-contract", { userId: "A0001" });
    expect(content.filename).toBe("Test PDF.pdf");
    expect(content.contentType).toBe("application/pdf");
    expect(mockGetS3ObjectBuffer).toHaveBeenCalledWith("uploads/contract.pdf");
  });

  it("compiles the Facility Agreement Package with child-note certificates", async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new FacilityDocumentsService({
      facilityAgreementPackageEvidence: { create },
    } as never);
    mockGetS3ObjectBuffer.mockImplementation(async (key: string) => {
      if (key.includes("fa.pdf")) return Buffer.from("%PDF-fa");
      if (key.includes("cert")) return Buffer.from("%PDF-cert");
      return Buffer.from("%PDF-other");
    });
    mockGenerateDocument.mockResolvedValue({
      buffer: Buffer.from("%PDF-lo"),
      filename: "LO.pdf",
      contentType: "application/pdf",
      templateSha256: "tmpl",
      outputSha256: "out",
    });

    const snapshot = {
      facilityId: "fac-1",
      facilityReference: "FAC-001",
      originatingApplicationId: "app-1",
      underlyingContract: null,
      envelope: {
        id: "env-1",
        status: "COMPLETED",
        application_id: "app-1",
        contract_id: "fac-1",
        invoice_id: null,
        completed_at: new Date(),
        documents: [],
      },
      jsg: null,
      facilityAgreement: {
        id: "doc-fa",
        name: "Facility Agreement",
        template_ref: "facility_agreement",
        signed_s3_key: "applications/app-1/fa.pdf",
        signed_file_sha256: "hash-fa",
        status: "COMPLETED",
      },
      doa: null,
      letterOfOffer: { hasContract: true, offerSent: true, declaredOnProduct: true },
      shoraka: [
        {
          id: "order-a",
          created_at: new Date("2026-09-01"),
          certificate_s3_key: "notes/n1/cert.pdf",
          certificate_file_sha256: "hash-cert",
          withdrawalInstruction: {
            withdrawal_type: "ISSUER_DISBURSEMENT",
            created_at: new Date("2026-09-01"),
          },
        },
        {
          id: "order-b",
          created_at: new Date("2026-09-02"),
          certificate_s3_key: null,
          certificate_file_sha256: null,
          withdrawalInstruction: {
            withdrawal_type: "ISSUER_RESIDUAL_RETURN",
            created_at: new Date("2026-09-02"),
          },
        },
      ],
      faPackageGeneratedAt: null,
    } satisfies FacilityDocumentCatalogSnapshot;

    const content = await (
      service as unknown as {
        composePackage: (
          snapshot: FacilityDocumentCatalogSnapshot,
          actor: { userId: string }
        ) => Promise<{ filename: string; contentType: string }>;
      }
    ).composePackage(snapshot, { userId: "A0001" });

    expect(content.filename).toBe("Facility-Agreement-Package-FAC-001.pdf");
    expect(content.contentType).toBe("application/pdf");
    expect(mockGenerateDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-1",
        typeKey: "arf_contract_facility_lo",
        contractId: "fac-1",
        invoiceId: null,
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note_id: null,
          application_id: "app-1",
          contract_id: "fac-1",
          invoice_id: null,
          assembler_version: 1,
          signed_fa_sha256: "hash-fa",
          lo_template_sha256: "tmpl",
          lo_output_sha256: "out",
          certificate_ids: ["order-a"],
          certificate_hashes: ["hash-cert"],
          created_by_user_id: "A0001",
        }),
      })
    );
  });
});
