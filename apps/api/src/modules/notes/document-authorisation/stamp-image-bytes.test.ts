import { deflateSync, crc32 } from "zlib";
import {
  COMPANY_STAMP_CROP_MESSAGE,
  COMPANY_STAMP_TOO_LARGE_MESSAGE,
  COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
  COMPANY_STAMP_MAX_FILE_SIZE_BYTES,
} from "@cashsouk/types";
import { inspectCompanyStampBytes } from "./stamp-image-bytes";

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

function makeJpeg(width: number, height: number): Buffer {
  const sof = Buffer.alloc(19);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 3;
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

function makeWebpVp8x(width: number, height: number): Buffer {
  const payload = Buffer.alloc(18);
  payload.write("VP8X", 0);
  payload.writeUInt32LE(10, 4);
  const w = width - 1;
  const h = height - 1;
  payload[8] = 0;
  payload[12] = w & 0xff;
  payload[13] = (w >> 8) & 0xff;
  payload[14] = (w >> 16) & 0xff;
  payload[15] = h & 0xff;
  payload[16] = (h >> 8) & 0xff;
  payload[17] = (h >> 16) & 0xff;
  const riffSize = 4 + payload.length;
  const header = Buffer.alloc(12);
  header.write("RIFF", 0);
  header.writeUInt32LE(riffSize, 4);
  header.write("WEBP", 8);
  return Buffer.concat([header, payload]);
}

describe("inspectCompanyStampBytes", () => {
  it("accepts valid PNG, JPEG, and WEBP stamps", () => {
    expect(inspectCompanyStampBytes(makePng(400, 400))).toBeNull();
    expect(inspectCompanyStampBytes(makeJpeg(800, 400))).toBeNull();
    expect(inspectCompanyStampBytes(makeWebpVp8x(512, 256))).toBeNull();
  });

  it("accepts a square PNG and a normal rectangle", () => {
    expect(inspectCompanyStampBytes(makePng(200, 200))).toBeNull();
    expect(inspectCompanyStampBytes(makePng(600, 300))).toBeNull();
  });

  it("rejects an unsupported payload even when the name would be .png", () => {
    expect(inspectCompanyStampBytes(Buffer.from("%PDF-1.7"))).toBe(
      COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE
    );
  });

  it("rejects an oversized buffer", () => {
    expect(inspectCompanyStampBytes(Buffer.alloc(COMPANY_STAMP_MAX_FILE_SIZE_BYTES + 1, 1))).toBe(
      COMPANY_STAMP_TOO_LARGE_MESSAGE
    );
  });

  it("rejects an extremely wide screenshot PNG", () => {
    expect(inspectCompanyStampBytes(makePng(40, 10))).toBe(COMPANY_STAMP_CROP_MESSAGE);
  });

  it("rejects an extremely tall PNG", () => {
    expect(inspectCompanyStampBytes(makePng(10, 40))).toBe(COMPANY_STAMP_CROP_MESSAGE);
  });
});
