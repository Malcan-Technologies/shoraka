import {
  freezeCertificateAuthorisation,
  freezeReceiptAuthorisation,
  parseDocumentAuthorisationConfig,
} from "./config";

const mockFindUnique = jest.fn();
const mockGetS3ObjectBuffer = jest.fn();

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    platformFinanceSetting: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

jest.mock("../../../lib/s3/client", () => ({
  getS3ObjectBuffer: (...args: unknown[]) => mockGetS3ObjectBuffer(...args),
}));

jest.mock("../../../lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

describe("parseDocumentAuthorisationConfig", () => {
  it("defaults to a blank signatory and shared stamp", () => {
    expect(parseDocumentAuthorisationConfig(null)).toEqual({
      authorisedSignatoryName: "",
      useSameCompanyStamp: true,
    });
  });

  it("parses a saved name, stamps, and use-same flag", () => {
    expect(
      parseDocumentAuthorisationConfig({
        authorisedSignatoryName: "  Ahmad  ",
        useSameCompanyStamp: false,
        certificateCompanyStamp: { s3Key: "stamps/cert.png", fileName: "cert.png", contentType: "image/png" },
        receiptCompanyStamp: { s3Key: "stamps/receipt.png" },
      })
    ).toEqual({
      authorisedSignatoryName: "Ahmad",
      useSameCompanyStamp: false,
      certificateCompanyStamp: {
        s3Key: "stamps/cert.png",
        fileName: "cert.png",
        contentType: "image/png",
      },
      receiptCompanyStamp: { s3Key: "stamps/receipt.png" },
    });
  });
});

describe("freezeCertificateAuthorisation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetS3ObjectBuffer.mockResolvedValue(Buffer.from("stamp-a"));
  });

  it("freezes the current signatory name and certificate stamp hash", async () => {
    mockFindUnique.mockResolvedValue({
      document_authorisation_config: {
        authorisedSignatoryName: "Ahmad",
        useSameCompanyStamp: true,
        certificateCompanyStamp: {
          s3Key: "stamps/a.png",
          fileName: "a.png",
          contentType: "image/png",
        },
      },
    });
    await expect(freezeCertificateAuthorisation()).resolves.toEqual({
      authorisedSignatoryName: "Ahmad",
      companyStamp: {
        s3Key: "stamps/a.png",
        sha256: expect.any(String),
        contentType: "image/png",
        fileName: "a.png",
      },
    });
  });

  it("leaves missing name and stamp blank without throwing", async () => {
    mockFindUnique.mockResolvedValue({ document_authorisation_config: null });
    await expect(freezeCertificateAuthorisation()).resolves.toEqual({
      authorisedSignatoryName: "",
      companyStamp: null,
    });
    expect(mockGetS3ObjectBuffer).not.toHaveBeenCalled();
  });

  it("keeps the stamp key when hashing fails", async () => {
    mockFindUnique.mockResolvedValue({
      document_authorisation_config: {
        authorisedSignatoryName: "Ahmad",
        certificateCompanyStamp: { s3Key: "stamps/missing.png" },
      },
    });
    mockGetS3ObjectBuffer.mockRejectedValue(new Error("s3 missing"));
    await expect(freezeCertificateAuthorisation()).resolves.toEqual({
      authorisedSignatoryName: "Ahmad",
      companyStamp: {
        s3Key: "stamps/missing.png",
        sha256: null,
        contentType: null,
        fileName: null,
      },
    });
  });
});

describe("freezeReceiptAuthorisation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetS3ObjectBuffer.mockResolvedValue(Buffer.from("stamp-bytes"));
  });

  it("uses the certificate stamp when useSameCompanyStamp is true", async () => {
    mockFindUnique.mockResolvedValue({
      document_authorisation_config: {
        authorisedSignatoryName: "Ahmad",
        useSameCompanyStamp: true,
        certificateCompanyStamp: { s3Key: "stamps/cert.png" },
        receiptCompanyStamp: { s3Key: "stamps/receipt.png" },
      },
    });
    const frozen = await freezeReceiptAuthorisation();
    expect(frozen.stampSource).toBe("SHARED_CERTIFICATE_STAMP");
    expect(frozen.companyStamp?.s3Key).toBe("stamps/cert.png");
  });

  it("uses the separate receipt stamp when useSameCompanyStamp is false", async () => {
    mockFindUnique.mockResolvedValue({
      document_authorisation_config: {
        useSameCompanyStamp: false,
        certificateCompanyStamp: { s3Key: "stamps/cert.png" },
        receiptCompanyStamp: { s3Key: "stamps/receipt.png" },
      },
    });
    const frozen = await freezeReceiptAuthorisation();
    expect(frozen.stampSource).toBe("SEPARATE_RECEIPT_STAMP");
    expect(frozen.companyStamp?.s3Key).toBe("stamps/receipt.png");
  });

  it("leaves a missing selected stamp blank", async () => {
    mockFindUnique.mockResolvedValue({
      document_authorisation_config: { useSameCompanyStamp: false },
    });
    await expect(freezeReceiptAuthorisation()).resolves.toEqual({
      stampSource: "SEPARATE_RECEIPT_STAMP",
      companyStamp: null,
    });
  });
});
