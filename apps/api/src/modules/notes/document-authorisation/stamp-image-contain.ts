import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";

export type StampExtentEmu = {
  cx: number;
  cy: number;
};

export type FittedStampImage = {
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  extent: StampExtentEmu;
};

/**
 * Fit the stamp into the authorisation table cell (~3080 twips / 2.14in wide).
 * A square EMU box with noChangeAspect=1 on a wide screenshot makes LibreOffice
 * fail or hang during Gotenberg conversion.
 */
export const MAX_STAMP_WIDTH_EMU = 1_555_000;
export const MAX_STAMP_HEIGHT_EMU = 792_000;

/** LibreOffice ignores wp:extent and lays the bitmap out at 96 DPI when metadata is absent. */
export const STAMP_IMAGE_LAYOUT_DPI = 96;

const EMU_PER_INCH = 914_400;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type RasterRgba = {
  width: number;
  height: number;
  data: Buffer;
};

export function maxStampPixelBox(): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((MAX_STAMP_WIDTH_EMU * STAMP_IMAGE_LAYOUT_DPI) / EMU_PER_INCH)),
    height: Math.max(1, Math.round((MAX_STAMP_HEIGHT_EMU * STAMP_IMAGE_LAYOUT_DPI) / EMU_PER_INCH)),
  };
}

export function stampExtentEmuFromPixels(width: number, height: number): StampExtentEmu {
  const w = width > 0 ? width : 1;
  const h = height > 0 ? height : 1;
  const heightIfFullWidth = Math.round((MAX_STAMP_WIDTH_EMU * h) / w);
  if (heightIfFullWidth <= MAX_STAMP_HEIGHT_EMU) {
    return { cx: MAX_STAMP_WIDTH_EMU, cy: Math.max(1, heightIfFullWidth) };
  }
  return {
    cx: Math.max(1, Math.round((MAX_STAMP_HEIGHT_EMU * w) / h)),
    cy: MAX_STAMP_HEIGHT_EMU,
  };
}

export function readPngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (bytes.subarray(0, 8).compare(PNG_SIGNATURE) !== 0) return null;
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

export function readWebpSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  const fourcc = bytes.toString("ascii", 12, 16);
  if (fourcc === "VP8X") {
    const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    if (width < 1 || height < 1) return null;
    return { width, height };
  }
  if (fourcc === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    const width = bytes.readUInt16LE(26) & 0x3fff;
    const height = bytes.readUInt16LE(28) & 0x3fff;
    if (width < 1 || height < 1) return null;
    return { width, height };
  }
  if (fourcc === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    if (width < 1 || height < 1) return null;
    return { width, height };
  }
  return null;
}

export function stampExtentEmu(bytes: Buffer): StampExtentEmu {
  const size = readPngSize(bytes) ?? readJpegSize(bytes) ?? readWebpSize(bytes);
  if (!size) return { cx: MAX_STAMP_HEIGHT_EMU, cy: MAX_STAMP_HEIGHT_EMU };
  return stampExtentEmuFromPixels(size.width, size.height);
}

function containPixelSize(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  const scale = Math.min(maxW / srcW, maxH / srcH, 1);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

function resizeRgbaNearest(src: RasterRgba, dstW: number, dstH: number): RasterRgba {
  if (src.width === dstW && src.height === dstH) {
    return { width: dstW, height: dstH, data: Buffer.from(src.data) };
  }
  const dst = Buffer.alloc(dstW * dstH * 4);
  for (let y = 0; y < dstH; y += 1) {
    const srcY = Math.min(src.height - 1, Math.floor((y * src.height) / dstH));
    for (let x = 0; x < dstW; x += 1) {
      const srcX = Math.min(src.width - 1, Math.floor((x * src.width) / dstW));
      const si = (srcY * src.width + srcX) * 4;
      const di = (y * dstW + x) * 4;
      dst[di] = src.data[si]!;
      dst[di + 1] = src.data[si + 1]!;
      dst[di + 2] = src.data[si + 2]!;
      dst[di + 3] = src.data[si + 3]!;
    }
  }
  return { width: dstW, height: dstH, data: dst };
}

function tryDecodeRaster(bytes: Buffer): RasterRgba | null {
  try {
    const png = PNG.sync.read(bytes);
    if (png.width < 1 || png.height < 1 || !png.data) return null;
    return { width: png.width, height: png.height, data: Buffer.from(png.data) };
  } catch {
    // Not a PNG pngjs can decode (or not a PNG).
  }
  try {
    const jpeg = decodeJpeg(bytes, { formatAsRGBA: true, tolerantDecoding: true });
    if (jpeg.width < 1 || jpeg.height < 1) return null;
    return { width: jpeg.width, height: jpeg.height, data: Buffer.from(jpeg.data) };
  } catch {
    return null;
  }
}

function encodePngRgba(raster: RasterRgba): Buffer {
  const png = new PNG({ width: raster.width, height: raster.height });
  png.data = raster.data;
  return PNG.sync.write(png);
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i]!;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function pixelsPerMeter(pixelCount: number, emu: number): number {
  const inches = emu / EMU_PER_INCH;
  if (pixelCount < 1 || inches <= 0) {
    return Math.round((STAMP_IMAGE_LAYOUT_DPI * 1000) / 25.4);
  }
  return Math.max(1, Math.round((pixelCount / inches) * (1000 / 25.4)));
}

export function pngWithPhysForExtent(
  bytes: Buffer,
  pixelWidth: number,
  pixelHeight: number,
  extent: StampExtentEmu
): Buffer | null {
  if (bytes.subarray(0, 8).compare(PNG_SIGNATURE) !== 0) return null;
  const physData = Buffer.alloc(9);
  physData.writeUInt32BE(pixelsPerMeter(pixelWidth, extent.cx), 0);
  physData.writeUInt32BE(pixelsPerMeter(pixelHeight, extent.cy), 4);
  physData[8] = 1;
  const phys = pngChunk("pHYs", physData);
  const out: Buffer[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let inserted = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) return null;
    if (type === "pHYs") {
      offset = chunkEnd;
      continue;
    }
    out.push(bytes.subarray(offset, chunkEnd));
    if (type === "IHDR" && !inserted) {
      out.push(phys);
      inserted = true;
    }
    if (type === "IEND") break;
    offset = chunkEnd;
  }
  if (!inserted) return null;
  return Buffer.concat(out);
}

function makeJfifApp0(dpiX: number, dpiY: number): Buffer {
  const payload = Buffer.alloc(16);
  payload.writeUInt16BE(16, 0);
  payload.write("JFIF\0", 2, 5, "ascii");
  payload[7] = 1;
  payload[8] = 2;
  payload[9] = 1;
  payload.writeUInt16BE(Math.max(1, Math.min(65535, dpiX)), 10);
  payload.writeUInt16BE(Math.max(1, Math.min(65535, dpiY)), 12);
  payload[14] = 0;
  payload[15] = 0;
  return Buffer.concat([Buffer.from([0xff, 0xe0]), payload]);
}

function jpegWithJfifDpi(bytes: Buffer, extent: StampExtentEmu, size: { width: number; height: number }): Buffer | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const dpiX = Math.max(1, Math.round(size.width / (extent.cx / EMU_PER_INCH)));
  const dpiY = Math.max(1, Math.round(size.height / (extent.cy / EMU_PER_INCH)));
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8]), makeJfifApp0(dpiX, dpiY)];
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (offset + 1 < bytes.length && bytes[offset] === 0xff && bytes[offset + 1] === 0xff) {
      offset += 1;
    }
    if (offset + 1 >= bytes.length) return null;
    const marker = bytes[offset + 1]!;
    if (marker === 0xda || marker === 0xd9) {
      parts.push(bytes.subarray(offset));
      return Buffer.concat(parts);
    }
    if ((marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) {
      parts.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) return null;
    const sizeBytes = bytes.readUInt16BE(offset + 2);
    const segEnd = offset + 2 + sizeBytes;
    if (segEnd > bytes.length) return null;
    const ident = bytes.toString("ascii", offset + 4, offset + 9);
    const skipJfif = marker === 0xe0 && ident.startsWith("JFIF");
    const skipExif = marker === 0xe1 && bytes.toString("ascii", offset + 4, offset + 8) === "Exif";
    if (!skipJfif && !skipExif) {
      parts.push(bytes.subarray(offset, segEnd));
    }
    offset = segEnd;
  }
  return Buffer.concat(parts);
}

function fallbackMime(contentType: string | null | undefined): FittedStampImage["contentType"] {
  const normalized = (contentType ?? "").trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/webp") return "image/webp";
  return "image/png";
}

/**
 * Contain the stamp/signature inside the authorisation cell.
 * Word uses wp:extent; LibreOffice uses native pixels at 96 DPI unless pHYs/JFIF
 * match the drawing. Downsampling to the 96 DPI box stops a large scan creating
 * a trailing page that only holds the image.
 */
export function fitStampImageForDocx(
  bytes: Buffer,
  contentType?: string | null
): FittedStampImage {
  const raster = tryDecodeRaster(bytes);
  if (raster) {
    const extent = stampExtentEmuFromPixels(raster.width, raster.height);
    const box = maxStampPixelBox();
    const target = containPixelSize(raster.width, raster.height, box.width, box.height);
    const fitted = resizeRgbaNearest(raster, target.width, target.height);
    const pngBytes = encodePngRgba(fitted);
    const withPhys = pngWithPhysForExtent(pngBytes, fitted.width, fitted.height, extent);
    return { bytes: withPhys ?? pngBytes, contentType: "image/png", extent };
  }

  const size = readPngSize(bytes) ?? readJpegSize(bytes) ?? readWebpSize(bytes);
  const extent = size
    ? stampExtentEmuFromPixels(size.width, size.height)
    : { cx: MAX_STAMP_HEIGHT_EMU, cy: MAX_STAMP_HEIGHT_EMU };
  if (size && readPngSize(bytes)) {
    const withPhys = pngWithPhysForExtent(bytes, size.width, size.height, extent);
    return { bytes: withPhys ?? bytes, contentType: "image/png", extent };
  }
  if (size && readJpegSize(bytes)) {
    const withDpi = jpegWithJfifDpi(bytes, extent, size);
    return { bytes: withDpi ?? bytes, contentType: "image/jpeg", extent };
  }
  return { bytes, contentType: fallbackMime(contentType), extent };
}
