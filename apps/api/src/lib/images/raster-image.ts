/**
 * PNG / JPEG byte inspection without a native image library.
 * Used for certificate-stamp layout and SigningCloud legal-asset confirm.
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type RasterImageKind = "png" | "jpeg";
export type RasterImageTransparency = "OPAQUE" | "ALPHA";

export type RasterImageInfo = {
  kind: RasterImageKind;
  contentType: "image/png" | "image/jpeg";
  width: number;
  height: number;
  transparency: RasterImageTransparency;
};

export function isPng(bytes: Buffer): boolean {
  return bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_MAGIC);
}

export function isJpeg(bytes: Buffer): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

export function readPngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || !isPng(bytes)) return null;
  if (bytes.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

export function readJpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
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

function pngHasAlpha(bytes: Buffer): boolean {
  if (bytes.length < 26 || !isPng(bytes) || bytes.toString("ascii", 12, 16) !== "IHDR") {
    return false;
  }
  const colorType = bytes[25];
  if (colorType === 4 || colorType === 6) return true;

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "tRNS") return true;
    if (type === "IEND") break;
    offset += 12 + length;
    if (length < 0 || offset > bytes.length) break;
  }
  return false;
}

export function inspectRasterImage(bytes: Buffer): RasterImageInfo | null {
  if (isPng(bytes)) {
    const size = readPngSize(bytes);
    if (!size) return null;
    return {
      kind: "png",
      contentType: "image/png",
      width: size.width,
      height: size.height,
      transparency: pngHasAlpha(bytes) ? "ALPHA" : "OPAQUE",
    };
  }
  const jpegSize = readJpegSize(bytes);
  if (!jpegSize) return null;
  return {
    kind: "jpeg",
    contentType: "image/jpeg",
    width: jpegSize.width,
    height: jpegSize.height,
    transparency: "OPAQUE",
  };
}
