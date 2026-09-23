import { AppError } from "../../../lib/http/error-handler";
import { FacilityDocumentsService } from "./service";

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

describe("FacilityDocumentsService content guards", () => {
  it("rejects unavailable catalog rows instead of streaming storage keys", async () => {
    const service = new FacilityDocumentsService({
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
    } as never);

    await expect(service.getContent("fac-1", "jsg", { userId: "A0001" })).rejects.toEqual(
      expect.objectContaining({
        code: "FACILITY_DOCUMENT_UNAVAILABLE",
      } satisfies Partial<AppError>)
    );
  });

  it("streams the uploaded commercial contract without returning the key", async () => {
    const service = new FacilityDocumentsService({
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
      signingEnvelope: { findMany: jest.fn().mockResolvedValue([]) },
      application: { findUnique: jest.fn().mockResolvedValue(null) },
      product: { findUnique: jest.fn(), findFirst: jest.fn() },
    } as never);
    mockGetS3ObjectBuffer.mockResolvedValue(Buffer.from("%PDF-contract"));

    const content = await service.getContent("fac-1", "underlying-contract", { userId: "A0001" });
    expect(content.filename).toBe("Test PDF.pdf");
    expect(content.contentType).toBe("application/pdf");
    expect(mockGetS3ObjectBuffer).toHaveBeenCalledWith("uploads/contract.pdf");
  });
});
