import { deflateSync, crc32 } from "zlib";
import { COMPANY_STAMP_CROP_MESSAGE } from "@cashsouk/types";

const mockGetS3ObjectBuffer = jest.fn();

jest.mock("../../../lib/s3/client", () => ({
  getS3ObjectBuffer: (...args: unknown[]) => mockGetS3ObjectBuffer(...args),
}));

import { assertCompanyStampS3Object } from "./stamp-image-persist";

function pngChunk(tag: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const type = Buffer.from(tag);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0);
  return Buffer.concat([length, type, data, crc]);
}

function makePng(width: number, height: number): Buffer {
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("assertCompanyStampS3Object with real byte inspection", () => {
  beforeEach(() => {
    mockGetS3ObjectBuffer.mockReset();
  });

  it("accepts a valid PNG fetched from S3", async () => {
    mockGetS3ObjectBuffer.mockResolvedValue(makePng(400, 400));
    await expect(
      assertCompanyStampS3Object("platform-finance/document-stamps/certificate/ok.png")
    ).resolves.toBeUndefined();
  });

  it("rejects screenshot bytes even if the object key ends in .png", async () => {
    mockGetS3ObjectBuffer.mockResolvedValue(makePng(40, 10));
    await expect(
      assertCompanyStampS3Object("platform-finance/document-stamps/certificate/screenshot.png")
    ).rejects.toMatchObject({
      code: "INVALID_COMPANY_STAMP",
      message: COMPANY_STAMP_CROP_MESSAGE,
    });
  });
});
