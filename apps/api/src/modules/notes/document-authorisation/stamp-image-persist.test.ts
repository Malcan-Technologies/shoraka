import { AppError } from "../../../lib/http/error-handler";
import {
  COMPANY_STAMP_CROP_MESSAGE,
  COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
} from "@cashsouk/types";

const mockGetS3ObjectBuffer = jest.fn();

jest.mock("../../../lib/s3/client", () => ({
  getS3ObjectBuffer: (...args: unknown[]) => mockGetS3ObjectBuffer(...args),
}));

jest.mock("./stamp-image-bytes", () => ({
  inspectCompanyStampBytes: jest.fn(),
}));

import { inspectCompanyStampBytes } from "./stamp-image-bytes";
import {
  assertCompanyStampS3Object,
  assertDocumentStampKeyMatchesPurpose,
  assertIncomingDocumentAuthorisationStamps,
} from "./stamp-image-persist";

const mockInspect = inspectCompanyStampBytes as jest.MockedFunction<typeof inspectCompanyStampBytes>;

describe("assertDocumentStampKeyMatchesPurpose", () => {
  it("accepts certificate and receipt prefixes", () => {
    expect(() =>
      assertDocumentStampKeyMatchesPurpose(
        "platform-finance/document-stamps/certificate/a.png",
        "CERTIFICATE_COMPANY_STAMP"
      )
    ).not.toThrow();
    expect(() =>
      assertDocumentStampKeyMatchesPurpose(
        "platform-finance/document-stamps/receipt/b.png",
        "RECEIPT_COMPANY_STAMP"
      )
    ).not.toThrow();
  });

  it("rejects a key for the other purpose", () => {
    expect(() =>
      assertDocumentStampKeyMatchesPurpose(
        "platform-finance/document-stamps/certificate/a.png",
        "RECEIPT_COMPANY_STAMP"
      )
    ).toThrow(AppError);
  });
});

describe("assertCompanyStampS3Object", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cannot be bypassed by a declared PNG that fails byte inspection", async () => {
    mockGetS3ObjectBuffer.mockResolvedValue(Buffer.from("not-an-image"));
    mockInspect.mockReturnValue(COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE);
    await expect(assertCompanyStampS3Object("platform-finance/document-stamps/certificate/x.png")).rejects.toMatchObject({
      code: "INVALID_COMPANY_STAMP",
      message: COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
    });
  });

  it("maps a screenshot layout failure to the admin crop message", async () => {
    mockGetS3ObjectBuffer.mockResolvedValue(Buffer.from("png"));
    mockInspect.mockReturnValue(COMPANY_STAMP_CROP_MESSAGE);
    await expect(assertCompanyStampS3Object("platform-finance/document-stamps/certificate/wide.png")).rejects.toMatchObject({
      message: COMPANY_STAMP_CROP_MESSAGE,
    });
  });

  it("hides S3 errors behind the unsupported-type message", async () => {
    mockGetS3ObjectBuffer.mockRejectedValue(new Error("NoSuchKey"));
    await expect(assertCompanyStampS3Object("missing")).rejects.toMatchObject({
      message: COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
    });
    expect(mockInspect).not.toHaveBeenCalled();
  });
});

describe("assertIncomingDocumentAuthorisationStamps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetS3ObjectBuffer.mockResolvedValue(Buffer.from("ok"));
    mockInspect.mockReturnValue(null);
  });

  it("validates a new shared certificate stamp", async () => {
    await assertIncomingDocumentAuthorisationStamps({
      previous: { authorisedSignatoryName: "", useSameCompanyStamp: true },
      next: {
        authorisedSignatoryName: "Ahmad",
        useSameCompanyStamp: true,
        certificateCompanyStamp: { s3Key: "platform-finance/document-stamps/certificate/a.png" },
      },
    });
    expect(mockGetS3ObjectBuffer).toHaveBeenCalledWith(
      "platform-finance/document-stamps/certificate/a.png"
    );
  });

  it("validates a new separate Hibah stamp when use-same is off", async () => {
    await assertIncomingDocumentAuthorisationStamps({
      previous: { authorisedSignatoryName: "", useSameCompanyStamp: false },
      next: {
        authorisedSignatoryName: "",
        useSameCompanyStamp: false,
        certificateCompanyStamp: { s3Key: "platform-finance/document-stamps/certificate/a.png" },
        receiptCompanyStamp: { s3Key: "platform-finance/document-stamps/receipt/b.png" },
      },
    });
    expect(mockGetS3ObjectBuffer).toHaveBeenCalledTimes(2);
  });

  it("does not inspect a separate Hibah stamp when use-same is on", async () => {
    await assertIncomingDocumentAuthorisationStamps({
      previous: { authorisedSignatoryName: "", useSameCompanyStamp: true },
      next: {
        authorisedSignatoryName: "",
        useSameCompanyStamp: true,
        certificateCompanyStamp: { s3Key: "platform-finance/document-stamps/certificate/a.png" },
        receiptCompanyStamp: { s3Key: "platform-finance/document-stamps/receipt/ignored.png" },
      },
    });
    expect(mockGetS3ObjectBuffer).toHaveBeenCalledTimes(1);
    expect(mockGetS3ObjectBuffer).toHaveBeenCalledWith(
      "platform-finance/document-stamps/certificate/a.png"
    );
  });

  it("skips unchanged stamp keys", async () => {
    await assertIncomingDocumentAuthorisationStamps({
      previous: {
        authorisedSignatoryName: "",
        useSameCompanyStamp: true,
        certificateCompanyStamp: { s3Key: "platform-finance/document-stamps/certificate/a.png" },
      },
      next: {
        authorisedSignatoryName: "Ahmad",
        useSameCompanyStamp: true,
        certificateCompanyStamp: { s3Key: "platform-finance/document-stamps/certificate/a.png" },
      },
    });
    expect(mockGetS3ObjectBuffer).not.toHaveBeenCalled();
  });
});
