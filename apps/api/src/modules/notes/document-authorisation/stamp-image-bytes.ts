import {
  COMPANY_STAMP_MAX_FILE_SIZE_BYTES,
  COMPANY_STAMP_TOO_LARGE_MESSAGE,
  COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
  companyStampLayoutRejection,
} from "@cashsouk/types";

type SniffedStampMime = "image/png" | "image/jpeg" | "image/webp";

function sniffStampMime(bytes: Buffer): SniffedStampMime | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function readPngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

function readJpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    const size = bytes.readUInt16BE(offset + 2);
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      if (width < 1 || height < 1) return null;
      return { width, height };
    }
    offset += 2 + size;
  }
  return null;
}

function readWebpSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 20) return null;
  const fourcc = bytes.toString("ascii", 12, 16);
  if (fourcc === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
    const height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
    if (width < 1 || height < 1) return null;
    return { width, height };
  }
  if (fourcc === "VP8 " && bytes.length >= 30) {
    const start = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (start < 0 || start + 5 >= bytes.length) return null;
    const width = bytes.readUInt16LE(start + 3) & 0x3fff;
    const height = bytes.readUInt16LE(start + 5) & 0x3fff;
    if (width < 1 || height < 1) return null;
    return { width, height };
  }
  if (fourcc === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return null;
}

function readStampSize(bytes: Buffer, mime: SniffedStampMime): { width: number; height: number } | null {
  if (mime === "image/png") return readPngSize(bytes);
  if (mime === "image/jpeg") return readJpegSize(bytes);
  return readWebpSize(bytes);
}

/**
 * Inspect raw stamp bytes. Trusts magic bytes, not file extension or declared MIME.
 */
export function inspectCompanyStampBytes(bytes: Buffer): string | null {
  if (bytes.length > COMPANY_STAMP_MAX_FILE_SIZE_BYTES) {
    return COMPANY_STAMP_TOO_LARGE_MESSAGE;
  }
  const mime = sniffStampMime(bytes);
  if (!mime) return COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE;
  const size = readStampSize(bytes, mime);
  if (!size) return COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE;
  return companyStampLayoutRejection(size.width, size.height) ?? null;
}
