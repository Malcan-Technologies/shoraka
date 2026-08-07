import { Readable } from "stream";

jest.mock("./client", () => ({
  getS3Client: jest.fn(),
  S3_BUCKET: "test-bucket",
}));

import { getS3Client } from "./client";
import {
  assertStoredLegalPdf,
  calculateS3ObjectSha256,
  isLegalDocumentS3Key,
  isSha256Hex,
  sanitizeS3KeyForLog,
} from "./legal-document-object";
import { createHash } from "crypto";

function mockBody(bytes: Buffer) {
  return Readable.from([bytes]);
}

describe("legal-document-object hashing", () => {
  const send = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getS3Client as jest.Mock).mockReturnValue({ send });
  });

  it("isLegalDocumentS3Key enforces prefix", () => {
    expect(isLegalDocumentS3Key("legal-documents/a.pdf")).toBe(true);
    expect(isLegalDocumentS3Key("other/a.pdf")).toBe(false);
  });

  it("sanitizeS3KeyForLog hides middle segments", () => {
    expect(sanitizeS3KeyForLog("legal-documents/type/v1-x.pdf")).toBe(
      "legal-documents/…/v1-x.pdf"
    );
  });

  it("calculates lowercase SHA-256 from S3 bytes", async () => {
    const pdf = Buffer.from("%PDF-1.4 hello world");
    const expected = createHash("sha256").update(pdf).digest("hex");
    send.mockResolvedValue({ Body: mockBody(pdf) });

    const result = await calculateS3ObjectSha256("legal-documents/t/v1.pdf");
    expect(result.sha256).toBe(expected);
    expect(isSha256Hex(result.sha256)).toBe(true);
    expect(result.byteLength).toBe(pdf.length);
  });

  it("same bytes produce same hash; different bytes differ", async () => {
    const a = Buffer.from("%PDF-1.4 aaa");
    const b = Buffer.from("%PDF-1.4 bbb");
    send.mockResolvedValueOnce({ Body: mockBody(a) });
    const ha = await calculateS3ObjectSha256("legal-documents/a.pdf");
    send.mockResolvedValueOnce({ Body: mockBody(b) });
    const hb = await calculateS3ObjectSha256("legal-documents/b.pdf");
    send.mockResolvedValueOnce({ Body: mockBody(a) });
    const ha2 = await calculateS3ObjectSha256("legal-documents/a.pdf");
    expect(ha.sha256).toBe(ha2.sha256);
    expect(ha.sha256).not.toBe(hb.sha256);
  });

  it("rejects missing object", async () => {
    const err = new Error("missing");
    err.name = "NoSuchKey";
    send.mockRejectedValue(err);
    await expect(calculateS3ObjectSha256("legal-documents/x.pdf")).rejects.toMatchObject({
      code: "S3_OBJECT_MISSING",
    });
  });

  it("rejects empty body", async () => {
    send.mockResolvedValue({ Body: undefined });
    await expect(calculateS3ObjectSha256("legal-documents/x.pdf")).rejects.toMatchObject({
      code: "S3_OBJECT_EMPTY",
    });
  });

  it("rejects empty stream", async () => {
    send.mockResolvedValue({ Body: mockBody(Buffer.alloc(0)) });
    await expect(calculateS3ObjectSha256("legal-documents/x.pdf")).rejects.toMatchObject({
      code: "S3_OBJECT_EMPTY",
    });
  });

  it("rejects non-PDF magic", async () => {
    send.mockResolvedValue({ Body: mockBody(Buffer.from("NOTPDF")) });
    await expect(calculateS3ObjectSha256("legal-documents/x.pdf")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects stream errors safely", async () => {
    async function* bad() {
      yield Buffer.from("%PDF");
      throw new Error("boom");
    }
    send.mockResolvedValue({ Body: bad() });
    await expect(calculateS3ObjectSha256("legal-documents/x.pdf")).rejects.toMatchObject({
      code: "S3_STREAM_FAILED",
    });
  });

  it("assertStoredLegalPdf rejects size mismatch and bad prefix", async () => {
    await expect(
      assertStoredLegalPdf({ s3Key: "evil/key.pdf", claimedFileSize: 1 })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const pdf = Buffer.from("%PDF-1.4 data");
    send.mockResolvedValue({ Body: mockBody(pdf) });
    await expect(
      assertStoredLegalPdf({
        s3Key: "legal-documents/t.pdf",
        claimedFileSize: pdf.length + 1,
      })
    ).rejects.toMatchObject({ code: "FILE_SIZE_MISMATCH" });
  });

  it("assertStoredLegalPdf returns server hash", async () => {
    const pdf = Buffer.from("%PDF-1.4 data");
    const expected = createHash("sha256").update(pdf).digest("hex");
    send.mockResolvedValue({ Body: mockBody(pdf) });
    const result = await assertStoredLegalPdf({
      s3Key: "legal-documents/t.pdf",
      claimedFileSize: pdf.length,
    });
    expect(result.fileHash).toBe(expected);
    expect(result.fileSize).toBe(pdf.length);
  });
});
